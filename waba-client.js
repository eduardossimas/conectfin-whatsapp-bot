/**
 * ConectFin WhatsApp Business API Client
 * 
 * Cliente unificado para WhatsApp Business API (WABA)
 * Suporta múltiplos provedores:
 * - Meta Cloud API (Oficial)
 * - Twilio
 * - 360Dialog
 * - Infobip
 * - MessageBird
 */

import axios from 'axios';
import { config } from './config/environment.js';

// ======================= CONFIGURAÇÃO =======================

let messageHandler = null;
let provider = null; // 'meta', 'twilio', '360dialog', 'infobip', 'messagebird'
let webhookServer = null;

// ======================= PROVEDORES =======================

/**
 * Configuração para Meta Cloud API
 */
const metaProvider = {
  name: 'Meta Cloud API',
  baseUrl: 'https://graph.facebook.com/v18.0',
  
  async sendText(to, text) {
    const url = `${this.baseUrl}/${config.WABA_PHONE_NUMBER_ID}/messages`;
    
    // 🔍 DEBUG: Verificar token
    const token = config.WABA_ACCESS_TOKEN?.trim().replace(/["'\r\n]/g, '');
    if (!token) {
      throw new Error('[WABA] TOKEN ausente (config.WABA_ACCESS_TOKEN)');
    }
    console.log(`[WABA DEBUG] Token length: ${token.length}, prefix: ${token.slice(0, 8)}...`);
    
    const response = await axios.post(url, {
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g, ''), // Remove formatação
      type: 'text',
      text: { body: text }
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  },
  
  async sendImage(to, imageUrl, caption = '') {
    const url = `${this.baseUrl}/${config.WABA_PHONE_NUMBER_ID}/messages`;
    
    const payload = {
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g, ''),
      type: 'image',
      image: {
        link: imageUrl
      }
    };
    
    if (caption) {
      payload.image.caption = caption;
    }
    
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${config.WABA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  },
  
  async uploadMedia(buffer, mimetype, filename) {
    // Upload de mídia para Meta
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimetype });
    formData.append('file', blob, filename);
    formData.append('messaging_product', 'whatsapp');
    
    const url = `${this.baseUrl}/${config.WABA_PHONE_NUMBER_ID}/media`;
    
    const response = await axios.post(url, formData, {
      headers: {
        'Authorization': `Bearer ${config.WABA_ACCESS_TOKEN}`,
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data.id; // Retorna media_id
  },
  
  parseWebhook(body) {
    // Parseia webhook do Meta
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];
    
    if (!message) return null;
    
    return {
      from: `+${message.from}`,
      type: message.type,
      text: message.text?.body || message.caption || '',
      caption: message.caption || '',
      timestamp: parseInt(message.timestamp),
      messageId: message.id,
      media: message.image || message.audio || message.document || message.video || null
    };
  }
};

/**
 * Configuração para Twilio
 */
const twilioProvider = {
  name: 'Twilio',
  baseUrl: 'https://api.twilio.com/2010-04-01',
  
  async sendText(to, text) {
    const url = `${this.baseUrl}/Accounts/${config.TWILIO_ACCOUNT_SID}/Messages.json`;
    
    const params = new URLSearchParams();
    params.append('From', `whatsapp:${config.TWILIO_PHONE_NUMBER}`);
    params.append('To', `whatsapp:${to}`);
    params.append('Body', text);
    
    const response = await axios.post(url, params, {
      auth: {
        username: config.TWILIO_ACCOUNT_SID,
        password: config.TWILIO_AUTH_TOKEN
      }
    });
    
    return response.data;
  },
  
  async sendImage(to, imageUrl, caption = '') {
    const url = `${this.baseUrl}/Accounts/${config.TWILIO_ACCOUNT_SID}/Messages.json`;
    
    const params = new URLSearchParams();
    params.append('From', `whatsapp:${config.TWILIO_PHONE_NUMBER}`);
    params.append('To', `whatsapp:${to}`);
    params.append('MediaUrl', imageUrl);
    if (caption) params.append('Body', caption);
    
    const response = await axios.post(url, params, {
      auth: {
        username: config.TWILIO_ACCOUNT_SID,
        password: config.TWILIO_AUTH_TOKEN
      }
    });
    
    return response.data;
  },
  
  parseWebhook(body) {
    // Parseia webhook do Twilio
    return {
      from: body.From?.replace('whatsapp:', ''),
      type: body.MediaUrl0 ? 'image' : 'text',
      text: body.Body || '',
      timestamp: Date.now(),
      messageId: body.MessageSid,
      media: body.MediaUrl0 ? { link: body.MediaUrl0 } : null
    };
  }
};

/**
 * Configuração para 360Dialog
 */
const dialog360Provider = {
  name: '360Dialog',
  baseUrl: 'https://waba.360dialog.io/v1',
  
  async sendText(to, text) {
    const url = `${this.baseUrl}/messages`;
    
    const response = await axios.post(url, {
      to: to.replace(/\D/g, ''),
      type: 'text',
      text: { body: text }
    }, {
      headers: {
        'D360-API-KEY': config.DIALOG360_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  },
  
  async sendImage(to, imageUrl, caption = '') {
    const url = `${this.baseUrl}/messages`;
    
    const payload = {
      to: to.replace(/\D/g, ''),
      type: 'image',
      image: {
        link: imageUrl
      }
    };
    
    if (caption) {
      payload.image.caption = caption;
    }
    
    const response = await axios.post(url, payload, {
      headers: {
        'D360-API-KEY': config.DIALOG360_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  },
  
  parseWebhook(body) {
    // 360Dialog usa o mesmo formato que Meta
    return metaProvider.parseWebhook(body);
  }
};

// ======================= MAPEAMENTO DE PROVEDORES =======================

const providers = {
  meta: metaProvider,
  twilio: twilioProvider,
  '360dialog': dialog360Provider
  // Adicionar outros provedores aqui
};

// ======================= FUNÇÕES PRINCIPAIS =======================

/**
 * Inicializa o cliente WABA
 * @param {string} providerName - Nome do provedor ('meta', 'twilio', etc)
 */
export async function startWABA(providerName = 'meta') {
  provider = providers[providerName];
  
  if (!provider) {
    throw new Error(`Provedor '${providerName}' não suportado. Use: ${Object.keys(providers).join(', ')}`);
  }
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log(`║         🚀 WhatsApp Business API: ${provider.name.padEnd(23)}║`);
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('✅ [WABA] Cliente inicializado com sucesso!');
  console.log(`📱 [WABA] Provedor: ${provider.name}`);
  console.log('📡 [WABA] Pronto para receber webhooks\n');
  
  return provider;
}

/**
 * Define o handler de mensagens
 * @param {Function} handler - Função que processa a mensagem
 */
export function onMessage(handler) {
  messageHandler = handler;
  console.log('✅ [WABA] Handler de mensagens configurado');
}

/**
 * Envia mensagem de texto
 * @param {string} to - Número de destino (formato E.164: +5532991473412)
 * @param {string} text - Texto da mensagem
 */
export async function sendText(to, text) {
  if (!provider) {
    throw new Error('WABA não inicializado. Execute startWABA() primeiro.');
  }
  
  console.log(`📤 [WABA] Enviando mensagem para ${to}`);
  
  try {
    const result = await provider.sendText(to, text);
    console.log('✅ [WABA] Mensagem enviada!');
    return result;
  } catch (error) {
    console.error('❌ [WABA] Erro ao enviar mensagem:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Envia imagem via WhatsApp Business API
 * 
 * IMPORTANTE: WABA requer URL pública ou upload de mídia
 * Você precisa hospedar a imagem em algum lugar (S3, Cloudinary, etc)
 * 
 * @param {string} to - Número de destino (formato E.164)
 * @param {string} imageUrl - URL público da imagem
 * @param {string} caption - Legenda opcional
 */
export async function sendImage(to, imageUrl, caption = '') {
  if (!provider) {
    throw new Error('WABA não inicializado. Execute startWABA() primeiro.');
  }
  
  console.log(`📤 [WABA] Enviando imagem para ${to}`);
  console.log(`🔗 [WABA] URL: ${imageUrl}`);
  
  try {
    const result = await provider.sendImage(to, imageUrl, caption);
    console.log('✅ [WABA] Imagem enviada!');
    return result;
  } catch (error) {
    console.error('❌ [WABA] Erro ao enviar imagem:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Faz upload de mídia (buffer) e retorna URL ou ID
 * Útil quando você tem um Buffer e precisa enviá-lo via WABA
 * 
 * @param {Buffer} buffer - Buffer da imagem/arquivo
 * @param {string} mimetype - Tipo MIME (image/png, image/jpeg, etc)
 * @param {string} filename - Nome do arquivo
 * @returns {Promise<string>} - URL ou ID da mídia
 */
export async function uploadMedia(buffer, mimetype, filename = 'media') {
  if (!provider) {
    throw new Error('WABA não inicializado. Execute startWABA() primeiro.');
  }
  
  if (!provider.uploadMedia) {
    throw new Error(`Provedor '${provider.name}' não suporta upload de mídia. Use URL pública.`);
  }
  
  console.log(`📤 [WABA] Fazendo upload de mídia: ${filename} (${buffer.length} bytes)`);
  
  try {
    const mediaId = await provider.uploadMedia(buffer, mimetype, filename);
    console.log(`✅ [WABA] Mídia enviada! ID: ${mediaId}`);
    return mediaId;
  } catch (error) {
    console.error('❌ [WABA] Erro ao fazer upload de mídia:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Processa webhook do provedor
 * Chamado pela rota Express quando o provedor envia uma mensagem
 * 
 * @param {Object} body - Body do webhook
 */
export async function handleWebhook(body) {
  if (!provider) {
    console.error('❌ [WABA] Cliente não inicializado');
    return;
  }
  
  console.log('\n📨 [WABA] Webhook recebido!');
  
  try {
    const message = provider.parseWebhook(body);
    
    if (!message) {
      console.log('⚠️ [WABA] Webhook ignorado (não é mensagem)');
      return;
    }
    
    console.log(`📱 [WABA] De: ${message.from}`);
    console.log(`📝 [WABA] Tipo: ${message.type}`);
    console.log(`💬 [WABA] Texto: ${message.text}`);
    
    // Chama o handler se configurado
    if (messageHandler) {
      await messageHandler(message);
    }
    
  } catch (error) {
    console.error('❌ [WABA] Erro ao processar webhook:', error);
  }
}

/**
 * Normaliza número de telefone para formato E.164
 * Exemplo: 32991473412 -> +5532991473412
 * Exemplo: +5532991473412 -> +5532991473412
 */
export function formatPhoneToE164(phone) {
  // Remove caracteres especiais
  let digits = phone.replace(/\D/g, '');
  
  // Se não começar com 55 (Brasil), adiciona
  if (!digits.startsWith('55') && digits.length === 11) {
    digits = '55' + digits;
  }
  
  return `+${digits}`;
}

/**
 * Para o cliente (placeholder - WABA não precisa de logout)
 */
export async function stopWABA() {
  console.log('🚪 [WABA] Cliente encerrado');
  provider = null;
}

// ======================= EXPORT =======================
export default {
  start: startWABA,
  stop: stopWABA,
  onMessage,
  sendText,
  sendImage,
  uploadMedia,
  handleWebhook,
  formatPhoneToE164
};
