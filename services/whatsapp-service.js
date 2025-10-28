/**
 * Serviço de WhatsApp - Centraliza envio de mensagens via Baileys/WAHA/Cloud API
 */

import axios from "axios";
import BaileysClient from '../baileys-client.js';
import { config } from "../config/environment.js";

/**
 * Envia mensagem de texto via WhatsApp
 * Tenta Baileys primeiro, depois WAHA e Cloud API como fallback
 * 
 * @param {string} to - Número de destino (formato E.164 com +)
 * @param {string} text - Texto da mensagem
 */
export async function sendWhatsAppText(to, text) {
  try {
    console.log(`📤 [SEND] Enviando via Baileys para ${to}: ${text.substring(0, 50)}...`);
    await BaileysClient.sendText(to, text);
    console.log(`✅ [SEND] Mensagem enviada com sucesso`);
    return { success: true, method: 'baileys' };
    
  } catch (error) {
    console.error('❌ [SEND] Erro ao enviar mensagem via Baileys:', error.message);
    
    // Fallback 1: WAHA
    if (config.WAHA_URL) {
      try {
        const phoneNumber = to.replace("+", "");
        const chatId = phoneNumber.includes('@c.us') ? phoneNumber : `${phoneNumber}@c.us`;
        
        console.log(`🔄 [SEND] Tentando WAHA como fallback...`);
        await axios.post(config.WAHA_URL, { 
          session: 'default',
          chatId, 
          text 
        }, {
          timeout: 10000
        });
        console.log(`✅ [SEND] Mensagem enviada via WAHA (fallback)`);
        return { success: true, method: 'waha' };
        
      } catch (wahaError) {
        console.error("❌ [SEND] WAHA fallback também falhou:", wahaError.message);
      }
    }
    
    // Fallback 2: WhatsApp Cloud API
    const isValidCloudConfig = 
      config.WA_CLOUD_PHONE_ID && 
      config.WA_CLOUD_TOKEN &&
      !config.WA_CLOUD_PHONE_ID.includes('seu_phone_id') &&
      !config.WA_CLOUD_TOKEN.includes('seu_token');

    if (isValidCloudConfig) {
      try {
        console.log(`🔄 [SEND] Tentando WhatsApp Cloud API como fallback...`);
        const url = `https://graph.facebook.com/v20.0/${config.WA_CLOUD_PHONE_ID}/messages`;
        await axios.post(
          url,
          {
            messaging_product: "whatsapp",
            to,
            text: { body: text },
          },
          {
            headers: { Authorization: `Bearer ${config.WA_CLOUD_TOKEN}` },
          }
        );
        console.log(`✅ [SEND] Mensagem enviada via Cloud API (fallback)`);
        return { success: true, method: 'cloud-api' };
        
      } catch (cloudError) {
        console.error("❌ [SEND] Cloud API fallback também falhou:", cloudError.message);
      }
    }
    
    throw new Error('Falha ao enviar mensagem por todos os métodos disponíveis');
  }
}

/**
 * Envia mensagem de imagem via WhatsApp
 * 
 * @param {string} to - Número de destino (formato E.164 com +)
 * @param {Buffer|string} image - Buffer da imagem ou URL
 * @param {string} caption - Legenda opcional
 */
export async function sendWhatsAppImage(to, image, caption = "") {
  try {
    console.log(`📤 [SEND] Enviando imagem via Baileys para ${to}`);
    await BaileysClient.sendImage(to, image, caption);
    console.log(`✅ [SEND] Imagem enviada com sucesso`);
    return { success: true, method: 'baileys' };
    
  } catch (error) {
    console.error('❌ [SEND] Erro ao enviar imagem via Baileys:', error.message);
    throw error;
  }
}

// Alias para compatibilidade
export const sendImageMessage = sendWhatsAppImage;

/**
 * Formata mensagem de erro amigável
 * 
 * @param {Error} error - Erro capturado
 * @returns {string} - Mensagem formatada para o usuário
 */
export function formatErrorMessage(error) {
  // Mensagem padrão
  let errorMessage = "❌ Não consegui processar sua mensagem agora. Pode tentar novamente?";
  
  // Erro de autenticação
  if (error.message && error.message.includes('401')) {
    errorMessage = "❌ Erro de configuração do WhatsApp. Entre em contato com o suporte.";
  }
  
  // IA indisponível
  if (error.message && (
    error.message.includes('503') || 
    error.message.includes('overloaded') || 
    error.message.includes('temporariamente indisponível')
  )) {
    errorMessage = "🤖 A IA está temporariamente sobrecarregada.\n\n⏱️ Tente novamente em alguns minutos.\n\nObrigado pela paciência! 😊";
  }
  
  // Banco não configurado
  if (error.message && error.message.includes('banco')) {
    errorMessage = error.message;
  }
  
  return errorMessage;
}
