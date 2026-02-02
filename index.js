/**
 * ConectFin WhatsApp Bot - Arquivo Principal Refatorado
 * 
 * Estrutura Modular:
 * - config/        → Configurações centralizadas
 * - services/      → Serviços (AI, WhatsApp, Database)
 * - handlers/      → Handlers de mensagens e rotas
 * - analyzers/     → Analisadores de texto e mídia
 * - utils/         → Funções auxiliares
 * - prompts/       → Prompts de IA
 * - tools/         → Sistema de Tools do Agente (NOVO)
 */

import express from "express";
import morgan from "morgan";
import BaileysClient from './baileys-client.js';
import { config } from './config/environment.js';

// ============ SISTEMA DE ROTEAMENTO ============
// Usar novo sistema de agente com tools (feature/agent-tools-system)
// Para voltar ao sistema antigo, troque para: './handlers/message-router.js'
import { handleWhatsAppMessage } from './handlers/agent-router.js';

import { 
  getAllUserCategorias, 
  getUserByPhone 
} from './services/database-service.js';
import { findBestCategory } from './services/ai-service.js';

// ======================= EXPRESS APP =======================
const app = express();
app.use(express.json({ limit: "25mb" }));
app.use(morgan("dev"));

// ======================= ROTAS WEB =======================

/**
 * Health check
 */
app.get("/", (_req, res) => {
  res.json({
    status: "online",
    service: "ConectFin WhatsApp Bot",
    version: "2.0.0",
    architecture: "modular",
    timestamp: new Date().toISOString()
  });
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

// ========================== INICIALIZAÇÃO =============================

/**
 * Inicia o bot (servidor Express + Baileys)
 */
async function startBot() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║         🚀 ConectFin Assistant v2.0                    ║');
  console.log('║         Arquitetura Modular                                ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  // Iniciar servidor Express
  app.listen(config.PORT, () => {
    console.log(`✅ [SERVER] Servidor HTTP rodando na porta ${config.PORT}`);
    console.log(`🌐 [SERVER] http://localhost:${config.PORT}`);
    console.log(`📱 [AUTH] Número autorizado: ${config.ALLOWED_WHATSAPP}\n`);
  });
  
  // Iniciar Baileys
  console.log('📱 [BAILEYS] Conectando ao WhatsApp...');
  console.log('👉 [BAILEYS] Aguarde o QR Code...\n');
  
  try {
    // Configurar handler de mensagens ANTES de conectar
    BaileysClient.onMessage(handleWhatsAppMessage);
    
    // Timeout de 90 segundos para escanear QR Code
    const connectPromise = BaileysClient.start();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout aguardando QR Code (90s)')), 90000)
    );
    
    await Promise.race([connectPromise, timeoutPromise]);
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                                                            ║');
    console.log('║         ✅ ASSISTENTE INICIADO COM SUCESSO!                 ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(`📱 Número autorizado: ${config.ALLOWED_WHATSAPP}`);
    console.log('💡 Aguardando mensagens...\n');
    
  } catch (error) {
    console.error('\n❌ [INICIO] Erro ao iniciar Baileys:', error.message);
    
    if (error.message.includes('Timeout')) {
      console.error('💡 [INICIO] O QR Code não foi escaneado a tempo.');
      console.error('💡 [INICIO] Execute o bot novamente (npm run dev) e escaneie mais rápido.\n');
    } else {
      console.error('💡 [INICIO] Dica: Verifique se você já escaneou o QR Code antes.\n');
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
    await BaileysClient.stop();
    console.log('✅ [SHUTDOWN] Desconectado do WhatsApp');
  } catch (error) {
    console.error('❌ [SHUTDOWN] Erro ao desconectar:', error);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n👋 [SHUTDOWN] Recebido SIGTERM, encerrando...');
  try {
    await BaileysClient.stop();
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
