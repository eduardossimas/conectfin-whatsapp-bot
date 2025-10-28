import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  downloadMediaMessage
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import { readdir, unlink, stat } from 'fs/promises';
import { join } from 'path';

// ======================= CONFIGURAÇÃO =======================
let sock = null;
let messageHandler = null;

// ======================= LIMPEZA DE CACHE =======================

/**
 * Limpa arquivos de sincronização antigos da pasta baileys_auth
 * Mantém apenas os arquivos essenciais (creds.json e arquivos recentes)
 */
async function cleanAuthCache() {
  try {
    const authDir = 'baileys_auth';
    const files = await readdir(authDir);
    
    // Arquivos CRÍTICOS que NUNCA devem ser deletados
    const criticalFiles = [
      'creds.json',
      'app-state-sync-version-critical_block.json',
      'app-state-sync-version-critical_unblock_low.json',
      'app-state-sync-version-regular_high.json',
      'app-state-sync-version-regular.json'
    ];
    
    // Filtrar arquivos por tipo (excluindo críticos)
    const preKeys = files.filter(f => f.startsWith('pre-key-') && !criticalFiles.includes(f));
    const syncKeys = files.filter(f => f.startsWith('app-state-sync-key-') && !criticalFiles.includes(f));
    
    let totalRemoved = 0;
    
    // 1. Limpar pre-keys excessivos (manter apenas 200 mais recentes)
    if (preKeys.length > 300) {
      console.log(`🧹 [BAILEYS] Limpando pre-keys: ${preKeys.length} arquivos`);
      const removed = await cleanFilesByAge(authDir, preKeys, 200);
      totalRemoved += removed;
      console.log(`  ✅ ${removed} pre-keys removidos, 200 mantidos`);
    }
    
    // 2. Limpar app-state-sync-keys antigos (manter apenas 20 mais recentes)
    if (syncKeys.length > 30) {
      console.log(`🧹 [BAILEYS] Limpando sync-keys: ${syncKeys.length} arquivos`);
      const removed = await cleanFilesByAge(authDir, syncKeys, 20);
      totalRemoved += removed;
      console.log(`  ✅ ${removed} sync-keys removidos, 20 mantidos`);
    }
    
    if (totalRemoved > 0) {
      console.log(`✅ [BAILEYS] Cache limpo: ${totalRemoved} arquivos removidos no total`);
    } else {
      console.log(`✅ [BAILEYS] Cache OK: pre-keys(${preKeys.length}), sync-keys(${syncKeys.length})`);
    }
  } catch (error) {
    console.error('❌ [BAILEYS] Erro ao limpar cache:', error.message);
  }
}

/**
 * Limpa arquivos por idade (mantém os N mais recentes)
 */
async function cleanFilesByAge(dir, files, keepCount) {
  if (files.length <= keepCount) return 0;
  
  // Pega informações de data de cada arquivo
  const filesWithStats = await Promise.all(
    files.map(async (file) => {
      const filePath = join(dir, file);
      const stats = await stat(filePath);
      return { file, mtime: stats.mtime, path: filePath };
    })
  );
  
  // Ordena por data (mais recentes primeiro)
  filesWithStats.sort((a, b) => b.mtime - a.mtime);
  
  // Mantém os N mais recentes, deleta o resto
  const filesToDelete = filesWithStats.slice(keepCount);
  
  let removed = 0;
  for (const { path, file } of filesToDelete) {
    try {
      await unlink(path);
      removed++;
    } catch (err) {
      console.log(`  ⚠️ Erro ao remover ${file}:`, err.message);
    }
  }
  
  return removed;
}

// ======================= FUNÇÕES AUXILIARES =======================

/**
 * Normaliza número de telefone para formato WhatsApp
 * Exemplo: +5532991473412 -> 5532991473412@s.whatsapp.net
 */
function formatPhoneToWhatsApp(phone) {
  // Remove caracteres especiais e mantém apenas números
  let digits = phone.replace(/\D/g, '');
  
  // Se começar com 55 (Brasil), mantém
  // Caso contrário, adiciona código do país se necessário
  if (!digits.startsWith('55') && digits.length === 11) {
    digits = '55' + digits;
  }
  
  return `${digits}@s.whatsapp.net`;
}

/**
 * Normaliza número do WhatsApp para formato E.164
 * Exemplo: 5532991473412@s.whatsapp.net -> +5532991473412
 */
function formatWhatsAppToE164(jid) {
  // Remove @s.whatsapp.net e @c.us
  const digits = jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
  return `+${digits}`;
}

/**
 * Detecta tipo de mensagem
 */
function detectMessageType(message) {
  const msg = message.message;
  
  if (msg?.conversation || msg?.extendedTextMessage) {
    return 'text';
  }
  if (msg?.imageMessage) {
    return 'image';
  }
  if (msg?.audioMessage || msg?.pttMessage) {
    return 'audio';
  }
  if (msg?.documentMessage) {
    return 'document';
  }
  if (msg?.videoMessage) {
    return 'video';
  }
  
  return 'unknown';
}

/**
 * Extrai texto da mensagem
 */
function extractMessageText(message) {
  const msg = message.message;
  
  if (msg?.conversation) {
    return msg.conversation;
  }
  if (msg?.extendedTextMessage?.text) {
    return msg.extendedTextMessage.text;
  }
  if (msg?.imageMessage?.caption) {
    return msg.imageMessage.caption;
  }
  if (msg?.videoMessage?.caption) {
    return msg.videoMessage.caption;
  }
  if (msg?.documentMessage?.caption) {
    return msg.documentMessage.caption;
  }
  
  return '';
}

/**
 * Faz download de mídia da mensagem
 */
async function downloadMedia(message) {
  try {
    const buffer = await downloadMediaMessage(
      message,
      'buffer',
      {},
      { 
        logger: pino({ level: 'silent' }),
        reuploadRequest: sock.updateMediaMessage
      }
    );
    
    // Detecta mimetype
    const msg = message.message;
    let mimetype = 'application/octet-stream';
    
    if (msg?.imageMessage) {
      mimetype = msg.imageMessage.mimetype || 'image/jpeg';
    } else if (msg?.audioMessage) {
      mimetype = msg.audioMessage.mimetype || 'audio/ogg';
    } else if (msg?.pttMessage) {
      mimetype = 'audio/ogg';
    } else if (msg?.documentMessage) {
      mimetype = msg.documentMessage.mimetype || 'application/pdf';
    } else if (msg?.videoMessage) {
      mimetype = msg.videoMessage.mimetype || 'video/mp4';
    }
    
    return {
      buffer,
      mimetype
    };
  } catch (error) {
    console.error('❌ [BAILEYS] Erro ao baixar mídia:', error);
    return null;
  }
}

// ======================= CONEXÃO =======================

/**
 * Inicia conexão com WhatsApp
 */
export async function startBaileys() {
  return new Promise(async (resolve, reject) => {
    // Limpar cache antes de conectar
    await cleanAuthCache();
    
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth');
    
    sock = makeWASocket({
      auth: state,
      // Removido printQRInTerminal pois está depreciado
      logger: pino({ level: 'silent' }), // Desativa logs do Baileys
      browser: ['ConectFin Bot', 'Chrome', '120.0.0'], // Identifica o bot
      connectTimeoutMs: 60000, // Timeout de 60 segundos
      defaultQueryTimeoutMs: undefined,
      keepAliveIntervalMs: 30000,
      emitOwnEvents: false,
      markOnlineOnConnect: true,
    });
    
    // ======================= EVENTOS =======================
    
    // Evento: Atualização de credenciais
    sock.ev.on('creds.update', saveCreds);
    
    // Evento: Atualização de conexão
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('\n📱 [BAILEYS] QR CODE GERADO! Escaneie agora:\n');
        qrcode.generate(qr, { small: true });
        console.log('\n👆 Como escanear:');
        console.log('1. Abra o WhatsApp no seu celular');
        console.log('2. Toque em "Mais opções" (⋮) ou "Configurações" (⚙️)');
        console.log('3. Toque em "Aparelhos conectados"');
        console.log('4. Toque em "Conectar um aparelho"');
        console.log('5. Aponte a câmera para o QR Code acima\n');
        console.log('⏳ Aguardando escaneamento...\n');
      }
      
      if (connection === 'connecting') {
        console.log('🔄 [BAILEYS] Conectando ao WhatsApp...');
      }
      
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error instanceof Boom) &&
          lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = DisconnectReason[statusCode] || 'desconhecido';
        
        console.log(`❌ [BAILEYS] Conexão fechada. Motivo: ${reason} (${statusCode})`);
        console.log('🔄 [BAILEYS] Reconectar?', shouldReconnect);
        
        if (shouldReconnect) {
          console.log('🔄 [BAILEYS] Reconectando em 3 segundos...');
          setTimeout(() => {
            startBaileys().then(resolve).catch(reject);
          }, 3000);
        } else {
          console.log('🚪 [BAILEYS] Desconectado. Execute novamente para reconectar.');
          reject(new Error(`Desconectado do WhatsApp: ${reason}`));
        }
      }
      
      if (connection === 'open') {
        console.log('\n✅ [BAILEYS] ========================================');
        console.log('✅ [BAILEYS] CONECTADO AO WHATSAPP COM SUCESSO!');
        console.log('✅ [BAILEYS] ========================================');
        console.log('📱 [BAILEYS] Número:', sock.user?.id);
        console.log('📝 [BAILEYS] Nome:', sock.user?.name || 'N/A');
        console.log('✅ [BAILEYS] ========================================\n');
        
        // Limpar cache periodicamente a cada 6 horas
        setInterval(() => {
          console.log('\n🧹 [BAILEYS] Executando limpeza periódica de cache...');
          cleanAuthCache();
        }, 6 * 60 * 60 * 1000); // 6 horas
        
        resolve(sock);
      }
    });
    
    // Evento: Novas mensagens
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      // Ignora mensagens antigas (histórico)
      if (type !== 'notify') return;
      
      for (const message of messages) {
        // Ignora mensagens próprias
        if (message.key.fromMe) continue;
        
        // Ignora mensagens de status (stories)
        if (message.key.remoteJid === 'status@broadcast') continue;
        
        console.log('\n📨 [BAILEYS] Nova mensagem recebida!');
        console.log('📱 [BAILEYS] De:', message.key.remoteJid);
        
        // Chama o handler se configurado
        if (messageHandler) {
          try {
            await messageHandler(message);
          } catch (error) {
            console.error('❌ [BAILEYS] Erro ao processar mensagem:', error);
          }
        }
      }
    });
  });
}

/**
 * Define o handler de mensagens
 * @param {Function} handler - Função que processa a mensagem
 */
export function onMessage(handler) {
  messageHandler = handler;
}

/**
 * Envia mensagem de texto
 */
export async function sendText(to, text) {
  if (!sock) {
    throw new Error('WhatsApp não conectado. Execute startBaileys() primeiro.');
  }
  
  const jid = to.includes('@') ? to : formatPhoneToWhatsApp(to);
  
  console.log(`📤 [BAILEYS] Enviando mensagem para ${jid}`);
  
  await sock.sendMessage(jid, { text });
  
  console.log('✅ [BAILEYS] Mensagem enviada!');
}

/**
 * Envia imagem via WhatsApp
 * 
 * @param {string} to - Número de destino (formato E.164 ou com @s.whatsapp.net)
 * @param {Buffer} imageBuffer - Buffer da imagem
 * @param {string} caption - Legenda opcional
 */
export async function sendImage(to, imageBuffer, caption = '') {
  if (!sock) {
    throw new Error('WhatsApp não conectado. Execute startBaileys() primeiro.');
  }
  
  const jid = to.includes('@') ? to : formatPhoneToWhatsApp(to);
  
  console.log(`📤 [BAILEYS] Enviando imagem para ${jid} (${imageBuffer.length} bytes)`);
  
  await sock.sendMessage(jid, { 
    image: imageBuffer,
    caption: caption
  });
  
  console.log('✅ [BAILEYS] Imagem enviada!');
}

/**
 * Processa mensagem recebida e retorna no formato padronizado
 */
export async function parseMessage(message) {
  const from = formatWhatsAppToE164(message.key.remoteJid);
  const type = detectMessageType(message);
  const text = extractMessageText(message);
  
  console.log(`🔍 [BAILEYS] Tipo: ${type}, De: ${from}`);
  
  const result = {
    from,
    type,
    text,
    caption: '',
    media: null,
    timestamp: message.messageTimestamp
  };
  
  // Se for mídia, faz download
  if (['image', 'audio', 'document', 'video'].includes(type)) {
    console.log('📥 [BAILEYS] Baixando mídia...');
    const media = await downloadMedia(message);
    
    if (media) {
      result.media = {
        buffer: media.buffer,
        mimetype: media.mimetype,
        // Converte para base64 para compatibilidade
        base64: media.buffer.toString('base64')
      };
      result.caption = text;
      console.log(`✅ [BAILEYS] Mídia baixada: ${media.buffer.length} bytes`);
    }
  }
  
  return result;
}

/**
 * Para a conexão
 */
export async function stopBaileys() {
  if (sock) {
    await sock.logout();
    sock = null;
    console.log('🚪 [BAILEYS] Desconectado do WhatsApp');
  }
}

/**
 * Retorna o socket atual (para uso avançado)
 */
export function getSocket() {
  return sock;
}

// ======================= EXPORT =======================
export default {
  start: startBaileys,
  stop: stopBaileys,
  onMessage,
  sendText,
  sendImage,
  parseMessage,
  getSocket
};
