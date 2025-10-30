/**
 * ConectFin WhatsApp Bot - Versão Unificada
 * 
 * Suporta dois tipos de conexão:
 * 1. Baileys (WhatsApp Web) - Para desenvolvimento/testes
 * 2. WABA (WhatsApp Business API) - Para produção
 * 
 * Configure no .env:
 * WHATSAPP_MODE=baileys  (ou 'waba')
 * WABA_PROVIDER=meta     (se usar WABA)
 */

import express from "express";
import morgan from "morgan";
import { config } from './config/environment.js';
import wabaConfig from './config/waba-config.js';
import { handleWhatsAppMessage } from './handlers/message-router.js';
import { 
  getAllUserCategorias, 
  getUserByPhone 
} from './services/database-service.js';
import { findBestCategory } from './services/ai-service.js';

// Importa cliente apropriado baseado no modo
let WhatsAppClient;
let clientMode = process.env.WHATSAPP_MODE || 'baileys'; // 'baileys' ou 'waba'

if (clientMode === 'waba') {
  const wabaModule = await import('./waba-client.js');
  WhatsAppClient = wabaModule.default;
  console.log('🔧 [INIT] Modo: WhatsApp Business API (WABA)');
} else {
  const baileysModule = await import('./baileys-client.js');
  WhatsAppClient = baileysModule.default;
  console.log('🔧 [INIT] Modo: Baileys (WhatsApp Web)');
}

// ======================= EXPRESS APP =======================
const app = express();
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true })); // Para webhooks
app.use(morgan("dev"));

// Servir arquivos estáticos (para mídia local)
import { fileURLToPath } from 'url';
import { dirname, join as pathJoin } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use('/media', express.static(pathJoin(__dirname, 'public/media')));

// ======================= ROTAS WEB =======================

/**
 * Health check
 */
app.get("/", (_req, res) => {
  res.json({
    status: "online",
    service: "ConectFin WhatsApp Bot",
    version: "3.0.0",
    mode: clientMode,
    provider: clientMode === 'waba' ? wabaConfig.provider : 'baileys',
    architecture: "modular",
    timestamp: new Date().toISOString()
  });
});

/**
 * Webhook para WABA (GET - Verificação)
 * O provedor WABA chama este endpoint para verificar o webhook
 */
app.get("/webhook/whatsapp", (req, res) => {
  if (clientMode !== 'waba') {
    return res.status(404).send('Webhook só disponível no modo WABA');
  }
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  console.log('🔐 [WEBHOOK] Verificação recebida');
  console.log('🔐 [WEBHOOK] Mode:', mode);
  console.log('🔐 [WEBHOOK] Token:', token);
  
  // Verifica se o token está correto
  if (mode === 'subscribe' && token === wabaConfig.meta.webhookVerifyToken) {
    console.log('✅ [WEBHOOK] Verificação bem-sucedida!');
    return res.status(200).send(challenge);
  } else {
    console.error('❌ [WEBHOOK] Verificação falhou!');
    return res.status(403).send('Forbidden');
  }
});

/**
 * Webhook para WABA (POST - Receber mensagens)
 * O provedor WABA envia mensagens para este endpoint
 */
app.post("/webhook/whatsapp", async (req, res) => {
  if (clientMode !== 'waba') {
    return res.status(404).send('Webhook só disponível no modo WABA');
  }
  
  console.log('\n📨 [WEBHOOK] Mensagem recebida!');
  
  try {
    // Responde rápido (200 OK) para o provedor
    res.status(200).send('OK');
    
    // Processa mensagem de forma assíncrona
    const { handleWebhook } = await import('./waba-client.js');
    await handleWebhook(req.body);
    
  } catch (error) {
    console.error('❌ [WEBHOOK] Erro ao processar:', error);
  }
});

/**
 * Endpoint para testar classificação de categorias
 * POST /test-category
 * Body: { user_id, categoria_sugerida, tipo_lancamento }
 */
app.post("/test-category", async (req, res) => {
  try {
    const { user_id, categoria_sugerida, tipo_lancamento } = req.body;
    
    if (!user_id || !categoria_sugerida) {
      return res.status(400).json({ 
        error: "user_id e categoria_sugerida são obrigatórios" 
      });
    }
    
    // Buscar categorias do usuário
    const allCategorias = await getAllUserCategorias(
      user_id, 
      tipo_lancamento || "despesa"
    );
    
    // Testar classificação
    const nomeCategoria = await findBestCategory(
      categoria_sugerida, 
      allCategorias
    );
    
    const categoriaEscolhida = allCategorias.find(
      cat => cat.nome.toLowerCase() === nomeCategoria?.toLowerCase()
    );
    
    res.json({
      entrada: {
        categoria_sugerida,
        tipo_lancamento: tipo_lancamento || "despesa",
        categorias_disponiveis: allCategorias.map(c => ({ 
          id: c.id, 
          nome: c.nome 
        }))
      },
      resultado: {
        categoria_nome: nomeCategoria,
        categoria_id: categoriaEscolhida?.id,
        match_encontrado: !!categoriaEscolhida
      }
    });
    
  } catch (error) {
    console.error("❌ [API] Erro no teste de categoria:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint para verificar se usuário está cadastrado
 * GET /user-check/:phone
 */
app.get("/user-check/:phone", async (req, res) => {
  try {
    const { phone } = req.params;
    const user = await getUserByPhone(phone);
    
    res.json({
      found: !!user,
      user: user ? {
        id: user.id,
        nome: user.nome,
        phone: user.phone_e164
      } : null
    });
    
  } catch (error) {
    console.error("❌ [API] Erro na verificação de usuário:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========================== ADAPTER HANDLER =============================

/**
 * Adapter para normalizar mensagens entre Baileys e WABA
 * Garante que o handler recebe sempre o mesmo formato
 */
async function messageAdapter(message) {
  console.log('\n🔄 [ADAPTER] Processando mensagem...');
  
  let normalizedMessage;
  
  if (clientMode === 'baileys') {
    // Baileys: precisa fazer parse
    normalizedMessage = await WhatsAppClient.parseMessage(message);
  } else {
    // WABA: já vem formatado do webhook
    normalizedMessage = message;
  }
  
  console.log('✅ [ADAPTER] Mensagem normalizada:', {
    from: normalizedMessage.from,
    type: normalizedMessage.type,
    text: normalizedMessage.text?.substring(0, 50) + '...'
  });
  
  // Passa para o handler principal
  await handleWhatsAppMessage(normalizedMessage);
}

// ========================== INICIALIZAÇÃO =============================

/**
 * Inicia o bot (servidor Express + WhatsApp Client)
 */
async function startBot() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║         🚀 ConectFin Assistant v3.0                    ║');
  console.log('║         Arquitetura Modular Unificada                      ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log(`🔧 [INIT] Modo: ${clientMode.toUpperCase()}`);
  if (clientMode === 'waba') {
    console.log(`🔧 [INIT] Provedor WABA: ${wabaConfig.provider}`);
  }
  console.log('');
  
  // Iniciar servidor Express
  app.listen(config.PORT, () => {
    console.log(`✅ [SERVER] Servidor HTTP rodando na porta ${config.PORT}`);
    console.log(`🌐 [SERVER] http://localhost:${config.PORT}`);
    console.log(`📱 [AUTH] Número autorizado: ${config.ALLOWED_WHATSAPP}\n`);
    
    if (clientMode === 'waba') {
      console.log('📡 [WEBHOOK] Endpoints disponíveis:');
      console.log(`   GET  ${wabaConfig.webhookUrl || '/webhook/whatsapp'} - Verificação`);
      console.log(`   POST ${wabaConfig.webhookUrl || '/webhook/whatsapp'} - Receber mensagens\n`);
    }
  });
  
  // Iniciar cliente WhatsApp
  try {
    // Configurar handler de mensagens ANTES de conectar
    WhatsAppClient.onMessage(messageAdapter);
    
    if (clientMode === 'baileys') {
      // Baileys: precisa conectar e escanear QR Code
      console.log('📱 [BAILEYS] Conectando ao WhatsApp...');
      console.log('👉 [BAILEYS] Aguarde o QR Code...\n');
      
      const connectPromise = WhatsAppClient.start();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout aguardando QR Code (90s)')), 90000)
      );
      
      await Promise.race([connectPromise, timeoutPromise]);
      
    } else {
      // WABA: apenas inicializa (não precisa de conexão)
      await WhatsAppClient.start(wabaConfig.provider);
      
      // Limpar arquivos antigos do Supabase Storage
      console.log('🧹 [INIT] Verificando arquivos antigos para limpar...');
      const { cleanOldMedia } = await import('./services/media-storage-service.js');
      await cleanOldMedia();
    }
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                                                            ║');
    console.log('║         ✅ ASSISTENTE INICIADO COM SUCESSO!                 ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(`📱 Número autorizado: ${config.ALLOWED_WHATSAPP}`);
    console.log('💡 Aguardando mensagens...\n');
    
  } catch (error) {
    console.error('\n❌ [INICIO] Erro ao iniciar WhatsApp:', error.message);
    
    if (clientMode === 'baileys' && error.message.includes('Timeout')) {
      console.error('💡 [INICIO] O QR Code não foi escaneado a tempo.');
      console.error('💡 [INICIO] Execute o bot novamente (npm run dev) e escaneie mais rápido.\n');
    }
    
    process.exit(1);
  }
}

// ======================= ERROR HANDLERS =======================

/**
 * Tratamento de erros não capturados
 */
process.on('unhandledRejection', (error) => {
  console.error('❌ [ERROR] Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ [ERROR] Uncaught exception:', error);
});

/**
 * Tratamento de encerramento gracioso
 */
process.on('SIGINT', async () => {
  console.log('\n\n👋 [SHUTDOWN] Encerrando bot...');
  try {
    await WhatsAppClient.stop();
    console.log('✅ [SHUTDOWN] Desconectado do WhatsApp');
  } catch (error) {
    console.error('❌ [SHUTDOWN] Erro ao desconectar:', error);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n👋 [SHUTDOWN] Recebido SIGTERM, encerrando...');
  try {
    await WhatsAppClient.stop();
    console.log('✅ [SHUTDOWN] Desconectado do WhatsApp');
  } catch (error) {
    console.error('❌ [SHUTDOWN] Erro ao desconectar:', error);
  }
  process.exit(0);
});

// ======================= START =======================
startBot().catch(error => {
  console.error('💥 [FATAL] Erro fatal ao iniciar bot:', error);
  process.exit(1);
});
