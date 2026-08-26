import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  downloadMediaMessage,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import { readdir, unlink, stat, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { getPhoneVariants } from './config/environment.js';
import { getUserByPhone } from './services/database-service.js';
import { sleep } from './utils/helpers.js';

// ======================= CONFIGURAÇÃO =======================
let sock = null;
let messageHandler = null;

// Cache de mapeamento LID -> número real
let lidMappingCache = {};

// Controle de tentativas de reconexão
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL_MS = 5000;

/**
 * Carrega os mapeamentos de LID para números reais
 */
async function loadLidMappings() {
  try {
    const authDir = 'baileys_auth';
    const files = await readdir(authDir);
    const lidFiles = files.filter(f => f.startsWith('lid-mapping-'));

    //console.log(`📂 [BAILEYS] ${files.length} arquivos, ${lidFiles.length} lid-mapping`);

    if (lidFiles.length > 0) {
      // Testar parse do primeiro arquivo
      const test = await readFile(join(authDir, lidFiles[0]), 'utf-8');

      //console.log(`📂 [BAILEYS] Conteúdo exemplo: ${test.substring(0,50)}`);

    }
    
    // Procurar arquivos lid-mapping-*_reverse.json
    const reverseMappings = files.filter(f => f.startsWith('lid-mapping-') && f.endsWith('_reverse.json'));
    
    for (const file of reverseMappings) {
      try {
        const content = await readFile(join(authDir, file), 'utf-8');
        // Extrair o LID do nome do arquivo: lid-mapping-XXXXX_reverse.json
        const lid = file.replace('lid-mapping-', '').replace('_reverse.json', '');
        const phoneNumber = JSON.parse(content);
        lidMappingCache[lid] = phoneNumber;

        //console.log(`📍 [BAILEYS] LID mapeado: ${lid} -> ${phoneNumber}`);

      } catch (e) {
        // Ignorar arquivos inválidos
      }
    }
    
    // Também carregar mapeamentos diretos: lid-mapping-NUMERO.json -> LID
    const directMappings = files.filter(f => f.startsWith('lid-mapping-') && !f.endsWith('_reverse.json'));
    
    for (const file of directMappings) {
      try {
        const content = await readFile(join(authDir, file), 'utf-8');
        // Extrair o número do nome do arquivo: lid-mapping-553291473412.json
        const phoneNumber = file.replace('lid-mapping-', '').replace('.json', '');
        const lid = JSON.parse(content);
        if (!lidMappingCache[lid]) {
          lidMappingCache[lid] = phoneNumber;

          //console.log(`📍 [BAILEYS] LID mapeado (reverso): ${lid} -> ${phoneNumber}`);

        }
      } catch (e) {
        // Ignorar arquivos inválidos
      }
    }
    
    console.log(`✅ [BAILEYS] ${Object.keys(lidMappingCache).length} mapeamentos de LID carregados`);
  } catch (error) {
    console.warn(`⚠️ [BAILEYS] Erro ao carregar mapeamentos LID:`, error.message);
  }
}

// ======================= LIMPEZA DE CACHE =======================

/**
 * Limpa arquivos de sincronização antigos da pasta baileys_auth
 * Mantém apenas os arquivos essenciais (creds.json e arquivos recentes)
 */
async function cleanAuthCache() {
  try {
    const authDir = 'baileys_auth';
    const files = await readdir(authDir);
    
    // Arquivos/padrões CRÍTICOS que NUNCA devem ser deletados
    const isCriticalFile = (filename) => {
      // Credenciais principais
      if (filename === 'creds.json') return true;
      
      // Versões de sincronização
      if (filename.startsWith('app-state-sync-version-')) return true;
      
      // Mapeamentos de LID (importantes para resolver números)
      if (filename.startsWith('lid-mapping-')) return true;
      
      // Lista de dispositivos
      if (filename.startsWith('device-list-')) return true;
      
      // Sessões ativas
      if (filename.startsWith('session-')) return true;
      
      return false;
    };
    
    // Filtrar arquivos por tipo (excluindo críticos)
    const preKeys = files.filter(f => f.startsWith('pre-key-') && !isCriticalFile(f));
    const syncKeys = files.filter(f => f.startsWith('app-state-sync-key-') && !isCriticalFile(f));
    
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
    // Se a pasta não existir, não é erro
    if (error.code === 'ENOENT') {
      console.log(`📁 [BAILEYS] Pasta baileys_auth será criada na primeira conexão`);
      return;
    }
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
 * Também resolve LIDs: 21981743317016@lid -> +553291473412
 */
function formatWhatsAppToE164(jid) {
  // Verificar se é um LID
  if (jid.endsWith('@lid')) {
    const lid = jid.replace('@lid', '');
    
    // Verificar se temos mapeamento para este LID
    if (lidMappingCache[lid]) {
      console.log(`🔄 [BAILEYS] Resolvendo LID: ${lid} -> ${lidMappingCache[lid]}`);
      return `+${lidMappingCache[lid]}`;
    }
      
      console.warn(`⚠️ [BAILEYS] LID não mapeado: ${lid}. Retornando identificador LID como fallback.`);
      return `lid:${lid}`;
  }
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
    
    // Carregar mapeamentos de LID
    await loadLidMappings();

    // Buscar versão mais recente do WhatsApp Web para evitar erros de protocolo (ex.: 405)
    let latestVersion;
    try {
      const { version, isLatest } = await fetchLatestBaileysVersion();
      latestVersion = version;
      console.log(`🔢 [BAILEYS] Versão WA Web: ${version.join('.')} (latest: ${isLatest})`);
    } catch (versionError) {
      console.warn(`⚠️ [BAILEYS] Não foi possível buscar versão mais recente: ${versionError.message}`);
      console.warn('⚠️ [BAILEYS] Continuando com versão padrão da biblioteca');
    }
    
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth');
    
    sock = makeWASocket({
      auth: state,
      ...(latestVersion ? { version: latestVersion } : {}),
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
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = DisconnectReason[statusCode] || 'desconhecido';
        
        console.log(`❌ [BAILEYS] Conexão fechada. Motivo: ${reason} (${statusCode})`);
        if (statusCode === 405) {
          console.log('💡 [BAILEYS] Código 405 geralmente indica incompatibilidade temporária de protocolo/versão do WhatsApp Web.');
          console.log('💡 [BAILEYS] Tentando reconectar com versão atualizada automaticamente...');
        }
        if (lastDisconnect?.error) {
          console.log('🧾 [BAILEYS] Detalhes do erro:', lastDisconnect.error.message || String(lastDisconnect.error));
        }
        
        // Determinar se deve reconectar baseado no código de erro
        let shouldReconnect = false;
        
        switch (statusCode) {
          case DisconnectReason.loggedOut:
            // Deslogado - precisa escanear QR code novamente
            console.log('🔐 [BAILEYS] Sessão encerrada. Necessário escanear QR code novamente.');
            reconnectAttempts = 0; // Reset para próxima sessão
            shouldReconnect = false;
            break;
            
          case DisconnectReason.restartRequired:
            // Reinício necessário - reconecta automaticamente
            console.log('🔄 [BAILEYS] Reinício necessário...');
            shouldReconnect = true;
            break;
            
          case DisconnectReason.connectionLost:
          case DisconnectReason.connectionClosed:
          case DisconnectReason.timedOut:
            // Problemas de conexão - tenta reconectar
            console.log('📡 [BAILEYS] Problema de conexão, tentando reconectar...');
            shouldReconnect = true;
            break;
            
          case DisconnectReason.badSession:
            // Sessão inválida - limpa cache e tenta reconectar
            console.log('⚠️ [BAILEYS] Sessão inválida, limpando cache antigo...');
            await cleanAuthCache();
            shouldReconnect = true;
            break;
            
          default:
            // Para outros erros, tenta reconectar se não foi logout explícito
            shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        }
        
        // Verificar limite de tentativas
        if (shouldReconnect && reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.log(`❌ [BAILEYS] Máximo de tentativas de reconexão atingido (${MAX_RECONNECT_ATTEMPTS}).`);
          console.log('💡 [BAILEYS] Tente deletar a pasta baileys_auth e escanear o QR code novamente.');
          shouldReconnect = false;
        }
        
        console.log('🔄 [BAILEYS] Reconectar?', shouldReconnect);
        
        if (shouldReconnect) {
          reconnectAttempts++;
          const delay = RECONNECT_INTERVAL_MS * reconnectAttempts; // Backoff exponencial
          console.log(`🔄 [BAILEYS] Tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}. Reconectando em ${delay/1000}s...`);
          setTimeout(() => {
            startBaileys().then(resolve).catch(reject);
          }, delay);
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
        
        // Resetar contador de tentativas após conexão bem-sucedida
        reconnectAttempts = 0;
        
        // Recarregar mapeamentos de LID após conexão
        await loadLidMappings();
        
        // Limpar cache periodicamente a cada 6 horas
        setInterval(() => {
          console.log('\n🧹 [BAILEYS] Executando limpeza periódica de cache...');
          cleanAuthCache();
        }, 6 * 60 * 60 * 1000); // 6 horas

        setTimeout(async () => {
          await loadLidMappings();

          //console.log(`📊 [BAILEYS] Após delay de 15s : ${Object.keys(lidMappingCache).length} mapeamentos`);

        }, 15000);
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

        // Autorização: todo número passa pela checagem no ConectFin.
        // Se estiver cadastrado, responde normalmente; se não, ignora silenciosamente.
        const from = formatWhatsAppToE164(message.key.remoteJid);

        if(from.startsWith('lid:')) {
          console.log(`⚠️ [BAILEYS] LID não resolvido, permitindo passagem: ${from}`);
        } else {
          const phoneVariants = getPhoneVariants(from);
          let user = null;
          for(const variant of phoneVariants) {
            console.log(`🔍 [BAILEYS] Verificando número no banco de dados: ${variant}`);
            user = await getUserByPhone(variant);
            if(user){
              console.log(`✅ [BAILEYS] Número autorizado via banco de dados: ${variant}`);
              break;
            }
          }
          if(!user) {
            console.log(`🚫 [BAILEYS] Mensagem de número não cadastrado: ${from}. Ignorando.`);
            continue;
          }
          console.log(`✅ [BAILEYS] Mensagem de número autorizado: ${from}, via Banco de Dados.`);
        }
        
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

    // Evento: Atualização de contatos (para mapear LIDs)
    sock.ev.on('contacts.upsert', async(contacts) => {
      for(const contact of contacts) {
      // contacts.upsert devolve objetos como:
      // { id: '5532991473412@s.whatsapp.net', lid: '21981743317016@lid', name: '...', notify: '...' }
    
        // Ignora contatos sem ID ou com ID de LID (não é número real é LID)
        if(!contact.id || contact.id.includes('@lid')) continue;

          const phoneNumber = contact.id.replace('@s.whatsapp.net', '').replace('@c.us', '');

          //Se tiver o campo lid, mapeia para o número real
          if(contact.lid && contact.lid.includes('@lid')){
            const lid = contact.lid.replace('@lid', '');
            if(!lidMappingCache[lid]){
              lidMappingCache[lid] = phoneNumber;

              //console.log(`🔄 [BAILEYS] Novo mapeamento LID detectado: ${lid} -> ${phoneNumber}`);

              //Persistir mapeamento em arquivo para futuras execuções
              try{
                await writeFile(join('baileys_auth', `lid-mapping-${lid}_reverse.json`), JSON.stringify(phoneNumber), 'utf-8');
              } catch(e){}
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

  if(to.includes('@lid')) {
    console.log(`⚠️ [BAILEYS] Tentativa de envio para LID: ${to}.`);
    await sock.sendMessage(to, { text });
    console.log('✅ [BAILEYS] Mensagem enviada!');
    return;
  }
  
  const jid = to.includes('@') ? to : formatPhoneToWhatsApp(to);
  
  console.log(`📤 [BAILEYS] Enviando mensagem para ${jid}`);
  try { await sock.sendPresenceUpdate('composing', jid); } catch(e) {}
  await sleep(500);   
  try { await sock.sendPresenceUpdate('paused', jid); } catch(e) {}
  await sleep(200);

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

  if(to.includes('@lid')) {
    console.log(`⚠️ [BAILEYS] Tentativa de envio para LID: ${to}.`);
    await sock.sendMessage(to, { image: imageBuffer, caption: caption });
    console.log('✅ [BAILEYS] Mensagem enviada!');
    return;
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
    originalJid: message.key.remoteJid,
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
