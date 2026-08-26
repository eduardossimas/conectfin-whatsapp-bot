/**
 * Message Router - Roteia mensagens baseado na intenção do usuário
 */

import { classifyIntent } from "../services/ai-service.js";
import { getUserByPhone } from "../services/database-service.js";
import { sendWhatsAppText, formatErrorMessage } from "../services/whatsapp-service-unified.js";
import { sleep, normalizePhoneE164 } from "../utils/helpers.js";
import { config, isAllowedWhatsAppPhone } from "../config/environment.js";
import BaileysClient from '../baileys-client.js';

// Handlers
import { handleGreeting } from "./greeting-handler.js";
import { handleCreateTransaction } from "./transaction-handler.js";
import { handleViewPayables, handleViewReceivables } from "./reports-handler.js";
import { handleCashFlowReport } from "./cashflow-handler.js";

/**
 * Handler principal de mensagens do WhatsApp
 * Classifica intenção e roteia para o handler apropriado
 * 
 * @param {Object} message - Mensagem bruta do Baileys OU já parseada do WABA
 */
export async function handleWhatsAppMessage(message) {
  try {
    console.log('\n🔄 [ROUTER] Processando mensagem recebida...');
    
    // ============ 1. PARSEAR MENSAGEM (se necessário) ============
    // Se já tem 'from', 'type', 'text' é porque já está parseada (WABA)
    let parsed;
    if (message.from && message.type !== undefined) {
      console.log('📦 [ROUTER] Mensagem já parseada (WABA mode)');
      parsed = message;
    } else {
      console.log('📦 [ROUTER] Parseando mensagem (Baileys mode)');
      parsed = await BaileysClient.parseMessage(message);
    }
    
    const { from, type, text, caption } = parsed;
    
    console.log(`📱 [ROUTER] De: ${from}, Tipo: ${type}`);

    // ============ 2. BUSCAR USUÁRIO NA API ============
    console.log(`🔍 [ROUTER] Buscando usuário na API: ${from}`);
    const user = await getUserByPhone(from);
    
    if (!user) {
      console.log(`⚠️ [ROUTER] Usuário não encontrado: ${from}. Ignorando mensagem silenciosamente.`);
      return;
    }

    console.log(`✅ [ROUTER] Usuário encontrado: ID ${user.id}, Nome: ${user.nome || 'N/A'}`);

    // ============ 3. CLASSIFICAR INTENÇÃO ============
    // Para mensagens de texto, classifica intenção
    // Para mensagens de mídia, assume criação de transação
    let intent = 'create_transaction'; // Default para mídias
    let intentData = { confidence: 1.0 };
    
    if (type === 'text' && text) {
      console.log(`🎯 [ROUTER] Classificando intenção da mensagem de texto...`);
      intentData = await classifyIntent(text);
      intent = intentData.intent;
      console.log(`✅ [ROUTER] Intenção classificada: ${intent} (confidence: ${intentData.confidence})`);
    } else {
      console.log(`📎 [ROUTER] Mensagem de mídia detectada, assumindo intenção: create_transaction`);
    }

    // ============ 4. ROTEAR PARA O HANDLER APROPRIADO ============
    console.log(`🚦 [ROUTER] Roteando para handler: ${intent}`);
    
    switch (intent) {
      case 'greeting':
        await handleGreeting(from, user, intentData);
        break;
        
      case 'create_transaction':
        await handleCreateTransaction(from, user, parsed);
        break;
        
      case 'view_payables':
        await handleViewPayables(from, user);
        break;
        
      case 'view_receivables':
        await handleViewReceivables(from, user);
        break;
        
      case 'view_cashflow':
        console.log('📊 [ROUTER] Roteando para handler: view_cashflow');
        await handleCashFlowReport(user.id, from, { ...intentData, original_message: text });
        break;
        
      case 'view_dre':
        // TODO: Implementar handler de DRE
        await sendWhatsAppText(
          from,
          "📈 *DRE (Demonstração do Resultado)*\n\nEsta funcionalidade será implementada em breve! 🚧\n\nPor enquanto, você pode:\n• Criar lançamentos\n• Ver contas a pagar/receber"
        );
        break;
        
      case 'unknown':
      default:
        console.log(`❓ [ROUTER] Intenção desconhecida ou não implementada: ${intent}`);
        await sendWhatsAppText(
          from,
          "🤔 Desculpe, não entendi sua solicitação.\n\nPosso ajudar você a:\n• Registrar despesas e receitas\n• Ver contas a pagar\n• Ver contas a receber\n\nTente reformular ou digite 'ajuda' para mais informações."
        );
        break;
    }
    
    console.log(`✅ [ROUTER] Processamento concluído com sucesso!`);
    
  } catch (err) {
    console.error("💥 [ROUTER] ERRO NO HANDLER:", err.message);
    console.error("💥 [ROUTER] Stack trace:", err.stack);
    
    // Log mais detalhado do erro
    if (err.response) {
      console.error("💥 [ROUTER] Response status:", err.response.status);
      console.error("💥 [ROUTER] Response data:", err.response.data);
    }
    
    try {
      console.log(`📤 [ROUTER] Tentando enviar mensagem de erro`);
      
      // Tentar extrair o número da mensagem (já parseada ou não)
      let from = config.ALLOWED_WHATSAPP;
      
      if (message.from) {
        // Mensagem já parseada (WABA)
        from = message.from;
      } else {
        // Mensagem Baileys, tentar parsear
        try {
          const parsed = await BaileysClient.parseMessage(message);
          from = parsed.from;
        } catch (parseErr) {
          console.error("❌ [ROUTER] Erro ao parsear mensagem para erro:", parseErr.message);
        }
      }
      
      if (from && isAllowedWhatsAppPhone(from)) {
        await sleep(250);
        const errorMessage = formatErrorMessage(err);
        
        console.log(`📤 [ROUTER] Enviando mensagem de erro para ${from}`);
        await sendWhatsAppText(from, errorMessage);
        console.log(`✅ [ROUTER] Mensagem de erro enviada`);
      }
    } catch (sendErr) {
      console.error("💥 [ROUTER] Erro ao enviar mensagem de erro:", sendErr.message);
    }
  }
}
