import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  downloadMediaMessage
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { Boom } from '@hapi/boom';

// ======================= CONFIGURAÇÃO =======================
let sock = null;
let messageHandler = null;

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
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth');
    
  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true, // Mostra QR code no terminal
    logger: pino({ level: 'silent' }), // Desativa logs do Baileys
    browser: ['ConectFin Bot', 'Chrome', '120.0.0'], // Identifica o bot
  });    // ======================= EVENTOS =======================
    
    // Evento: Atualização de credenciais
    sock.ev.on('creds.update', saveCreds);
    
    // Evento: Atualização de conexão
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('\n📱 [BAILEYS] Escaneie o QR Code abaixo com seu WhatsApp:\n');
        qrcode.generate(qr, { small: true });
        console.log('\n👆 Abra o WhatsApp no celular > Dispositivos conectados > Conectar dispositivo\n');
      }
      
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error instanceof Boom) &&
          lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        console.log('❌ [BAILEYS] Conexão fechada. Reconectar?', shouldReconnect);
        
        if (shouldReconnect) {
          console.log('🔄 [BAILEYS] Reconectando...');
          await startBaileys();
        } else {
          console.log('🚪 [BAILEYS] Desconectado. Execute novamente para reconectar.');
          reject(new Error('Desconectado do WhatsApp'));
        }
      }
      
      if (connection === 'open') {
        console.log('✅ [BAILEYS] Conectado ao WhatsApp!');
        console.log('📱 [BAILEYS] Número:', sock.user?.id);
        console.log('📝 [BAILEYS] Nome:', sock.user?.name);
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
  parseMessage,
  getSocket
};
