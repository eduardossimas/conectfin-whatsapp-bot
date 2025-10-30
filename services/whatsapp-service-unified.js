/**
 * Serviço de WhatsApp - Versão Unificada
 * 
 * Suporta múltiplos clientes:
 * 1. Baileys (WhatsApp Web)
 * 2. WABA (WhatsApp Business API - Meta, Twilio, 360Dialog, etc)
 * 
 * Detecta automaticamente qual cliente usar baseado em WHATSAPP_MODE
 */

import { config } from "../config/environment.js";
import { saveMedia } from './media-storage-service.js';

// Detecta modo
const WHATSAPP_MODE = process.env.WHATSAPP_MODE || 'baileys';

// Importa cliente apropriado
let WhatsAppClient;

if (WHATSAPP_MODE === 'waba') {
  const wabaModule = await import('../waba-client.js');
  WhatsAppClient = wabaModule.default;
} else {
  const baileysModule = await import('../baileys-client.js');
  WhatsAppClient = baileysModule.default;
}

/**
 * Envia mensagem de texto via WhatsApp
 * Funciona com Baileys ou WABA automaticamente
 * 
 * @param {string} to - Número de destino (formato E.164 com +)
 * @param {string} text - Texto da mensagem
 */
export async function sendWhatsAppText(to, text) {
  try {
    console.log(`📤 [SEND] Enviando via ${WHATSAPP_MODE.toUpperCase()} para ${to}`);
    console.log(`📝 [SEND] Mensagem: ${text.substring(0, 100)}...`);
    
    await WhatsAppClient.sendText(to, text);
    
    console.log(`✅ [SEND] Mensagem enviada com sucesso`);
    return { success: true, method: WHATSAPP_MODE };
    
  } catch (error) {
    console.error(`❌ [SEND] Erro ao enviar mensagem via ${WHATSAPP_MODE}:`, error.message);
    
    // Se estiver usando WABA e falhar, não há fallback (WABA é o método definitivo)
    if (WHATSAPP_MODE === 'waba') {
      throw new Error('Falha ao enviar mensagem via WABA: ' + error.message);
    }
    
    throw error;
  }
}

/**
 * Envia mensagem de imagem via WhatsApp
 * 
 * IMPORTANTE:
 * - Baileys: aceita Buffer diretamente
 * - WABA: precisa de URL pública (faz upload automático via saveMedia)
 * 
 * @param {string} to - Número de destino (formato E.164 com +)
 * @param {Buffer} imageBuffer - Buffer da imagem
 * @param {string} caption - Legenda opcional
 */
export async function sendWhatsAppImage(to, imageBuffer, caption = "") {
  try {
    console.log(`📤 [SEND] Enviando imagem via ${WHATSAPP_MODE.toUpperCase()} para ${to}`);
    console.log(`📸 [SEND] Tamanho: ${imageBuffer.length} bytes`);
    
    if (WHATSAPP_MODE === 'waba') {
      // WABA: precisa de URL pública
      console.log('📤 [SEND] WABA detectado - fazendo upload de mídia...');
      
      // Faz upload da imagem e pega URL pública
      const imageUrl = await saveMedia(imageBuffer, 'chart', 'image/png');
      
      console.log(`🔗 [SEND] URL pública: ${imageUrl}`);
      console.log(`📤 [SEND] Enviando via WABA...`);
      
      // Envia via WABA usando a URL
      await WhatsAppClient.sendImage(to, imageUrl, caption);
      
    } else {
      // Baileys: envia Buffer diretamente
      console.log(`📤 [SEND] Enviando Buffer diretamente via Baileys...`);
      await WhatsAppClient.sendImage(to, imageBuffer, caption);
    }
    
    console.log(`✅ [SEND] Imagem enviada com sucesso`);
    return { success: true, method: WHATSAPP_MODE };
    
  } catch (error) {
    console.error(`❌ [SEND] Erro ao enviar imagem via ${WHATSAPP_MODE}:`, error.message);
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
  
  // Erro WABA específico
  if (WHATSAPP_MODE === 'waba') {
    if (error.message && error.message.includes('WABA')) {
      errorMessage = "❌ Erro na API do WhatsApp Business.\n\n⏱️ Tente novamente em alguns minutos.";
    }
  }
  
  return errorMessage;
}

/**
 * Retorna informações sobre o modo atual
 */
export function getWhatsAppMode() {
  return {
    mode: WHATSAPP_MODE,
    client: WHATSAPP_MODE === 'waba' ? 'WhatsApp Business API' : 'Baileys (WhatsApp Web)'
  };
}
