/**
 * Agent Router - Novo sistema de roteamento baseado em Tools
 * 
 * Este router substitui o antigo message-router.js usando uma abordagem
 * mais inteligente onde a IA decide qual ação tomar através de tools.
 */

import { runAgent } from "../services/ai-service.js";
import { getUserByPhone } from "../services/database-service.js";
import { sendWhatsAppText, formatErrorMessage } from "../services/whatsapp-service-unified.js";
import { executeTool } from "../tools/index.js";
import { sleep } from "../utils/helpers.js";
import { config, isAllowedWhatsAppPhone, getPhoneVariants } from "../config/environment.js";
import BaileysClient from '../baileys-client.js';
import { addMessage, getConversationHistory } from "../services/conversation-memory.js";

/**
 * Handler principal de mensagens - Sistema de Agente com Tools
 * 
 * @param {Object} message - Mensagem bruta do Baileys OU já parseada do WABA
 */
export async function handleWhatsAppMessageAgent(message) {
  let from;
  
  try {
    console.log('\n🤖 [AGENT-ROUTER] Processando mensagem com sistema de agente...');
    
    // ============ 1. PARSEAR MENSAGEM (se necessário) ============
    let parsed;
    if (message.from && message.type !== undefined) {
      console.log('📦 [AGENT-ROUTER] Mensagem já parseada (WABA mode)');
      parsed = message;
    } else {
      console.log('📦 [AGENT-ROUTER] Parseando mensagem (Baileys mode)');
      parsed = await BaileysClient.parseMessage(message);
    }
    
    from = parsed.from;
    const { type, text, caption, media } = parsed;
    
    console.log(`📱 [AGENT-ROUTER] De: ${from}, Tipo: ${type}`);


    
    // ============ 2. BUSCAR USUÁRIO NA API ============
    console.log(`🔍 [AGENT-ROUTER] Buscando usuário na API: ${from}`);
    const phoneVariants = getPhoneVariants(from);
    let user = null;
    for(const variant of phoneVariants) {
      user = await getUserByPhone(variant);
      if(user) {
        console.log(`✅ [AGENT-ROUTER] Usuário encontrado via banco de dados: ${variant}`);
        from = variant; // Atualiza o "from" para o número autorizado
        break;
      }
    }

    if(!user) {
      console.log(`⚠️ [AGENT-ROUTER] Usuário não encontrado: ${from}. Ignorando mensagem.`);
      return;
    }
    if(from.startsWith('lid:')) {
      console.log(`⚠️ [AGENT-ROUTER] LID não resolvido, solicitando identificação do usuário: ${from}`);
      const lid = from.replace('lid:', '');
      const lidJid = `${lid}@lid`;

    await sendWhatsAppText(lidJid,
    "Olá! 👋\n\nPara usar o ConectFin, preciso primeiro identificar sua conta.\n\n📧 Por favor, informe o **email** que você cadastrou no ConectFin."
    );

      // Guarda na memória que este LID está aguardando identificação
    addMessage(from, 'user',
    `[SISTEMA] LID não resolvido: ${lid}. Solicitação de email enviada para ${lidJid}`
    );
    return;
  }

    user = await getUserByPhone(from);
    
    if (!user) {
      console.log(`⚠️ [AGENT-ROUTER] Usuário não encontrado: ${from}. Ignorando mensagem.`);
      return;
    }

    console.log(`✅ [AGENT-ROUTER] Usuário: ${user.nome || 'N/A'} (ID: ${user.id})`);

    // ============ 3. PREPARAR MENSAGEM DO USUÁRIO ============
    let userMessage = text || caption || "";
    let mediaParts = [];
    
    // Se for mídia, preparar para o LLM
    if (type === 'image' && media) {
      mediaParts.push({
        inlineData: {
          mimeType: media.mimetype || "image/jpeg",
          data: media.buffer.toString("base64")
        }
      });
      userMessage = caption || "Imagem enviada sem legenda - analise o conteúdo";
    } else if (type === 'audio' && media) {
      mediaParts.push({
        inlineData: {
          mimeType: media.mimetype || "audio/ogg",
          data: media.buffer.toString("base64")
        }
      });
      userMessage = "Áudio enviado - transcreva e analise o conteúdo";
    } else if (type === 'document' && media) {
      if (media.mimetype?.includes('pdf')) {
        // Para PDF, precisamos de tratamento especial (OCR ou extração de texto)
        userMessage = caption || "Documento PDF enviado - analise o conteúdo";
        // TODO: Implementar extração de texto do PDF antes de enviar ao agente
      }
    }
    
    if (!userMessage && mediaParts.length === 0) {
      console.log(`⚠️ [AGENT-ROUTER] Mensagem vazia, ignorando`);
      return;
    }

    // ============ 4. SALVAR MENSAGEM DO USUÁRIO NA MEMÓRIA ============
    addMessage(from, 'user', userMessage);
    
    // ============ 5. RECUPERAR HISTÓRICO DE CONVERSA ============
    const conversationHistory = getConversationHistory(from);
    
    // ============ 6. PREPARAR CONTEXTO PARA O AGENTE ============
    const context = {
      user,
      from,
      originalJid: parsed.originalJid,
      userName: null, // TODO: Implementar busca de nome do usuário no futuro
      messageType: type,
      conversationHistory // Histórico da conversa
    };

    // ============ 7. EXECUTAR O AGENTE ============
    console.log(`🧠 [AGENT-ROUTER] Executando agente...`);
    const agentResponse = await runAgent(userMessage, mediaParts, context);
    
    console.log(`📤 [AGENT-ROUTER] Resposta do agente:`, JSON.stringify(agentResponse, null, 2));

    // ============ 8. PROCESSAR RESPOSTA DO AGENTE ============
    const assistantMessage = await processAgentResponse(agentResponse, context);
    
    // ============ 9. SALVAR RESPOSTA DO ASSISTENTE NA MEMÓRIA ============
    if (assistantMessage) {
      addMessage(from, 'assistant', assistantMessage);
    }
    
    console.log(`✅ [AGENT-ROUTER] Processamento concluído!`);
    
  } catch (err) {
    console.error("💥 [AGENT-ROUTER] ERRO:", err.message);
    console.error("💥 [AGENT-ROUTER] Stack:", err.stack);
    
    try {
      const errorsendTo = originalJid || from;
      if (errorsendTo) {
        await sleep(250);
        const errorMessage = formatErrorMessage(err);
        await sendWhatsAppText(errorsendTo, errorMessage);
      }
    } catch (sendErr) {
      console.error("💥 [AGENT-ROUTER] Erro ao enviar mensagem de erro:", sendErr.message);
    }
  }
}

// Lista de tools válidas para detecção automática
const VALID_TOOLS = ['create_transaction', 'get_payables', 'get_receivables', 'get_cashflow', 'analyze_cashflow', 'list_transactions'];

/**
 * Processa a resposta do agente e executa a ação apropriada
 * Retorna a mensagem enviada ao usuário para salvar na memória
 * 
 * @param {Object} agentResponse - Resposta do agente
 * @param {Object} context - Contexto da conversa
 * @returns {Promise<string|null>} - Mensagem enviada ao usuário
 */
async function processAgentResponse(agentResponse, context) {
  const { from, user, originalJid } = context;
  const sendTo = originalJid || from; // Prioriza o JID original se disponível
  let { action, tool, parameters, message, message_to_user } = agentResponse;
  
  let sentMessage = null;
  
  // ============ NORMALIZAÇÃO DE RESPOSTA ============
  // Se o modelo retornou o nome da tool como action (ex: action: "get_cashflow")
  // Corrigir para o formato esperado
  if (VALID_TOOLS.includes(action)) {
    console.log(`🔄 [AGENT-ROUTER] Normalizando: action "${action}" → call_tool`);
    tool = action;
    action = "call_tool";
  }
  
  switch (action) {
    case "respond":
    case "ask_user":
      // Resposta direta ao usuário (sem chamar tool)
      if (message) {
        await sendWhatsAppText(sendTo, message);
        sentMessage = message;
      }
      break;
      
    case "call_tool":
      // Se há mensagem prévia, envia primeiro
      if (message_to_user) {
        await sendWhatsAppText(sendTo, message_to_user);
        await sleep(500);
      }
      
      // Executar a tool
      console.log(`🔧 [AGENT-ROUTER] Executando tool: ${tool}`);
      const toolResult = await executeTool(tool, parameters || {}, context);
      
      console.log(`📊 [AGENT-ROUTER] Resultado da tool:`, JSON.stringify(toolResult, null, 2));
      
      // Processar resultado da tool e capturar mensagem
      sentMessage = await processToolResult(toolResult, tool, context);
      break;
      
    default:
      console.warn(`⚠️ [AGENT-ROUTER] Ação desconhecida: ${action}`);
      sentMessage = "Desculpe, não consegui processar sua solicitação. Tente novamente.";
      await sendWhatsAppText(sendTo, sentMessage);
  }
  
  return sentMessage;
}

/**
 * Processa o resultado de uma tool executada
 * Retorna a mensagem enviada para salvar na memória
 * 
 * @param {Object} result - Resultado da tool
 * @param {string} toolName - Nome da tool executada
 * @param {Object} context - Contexto da conversa
 * @returns {Promise<string|null>} - Mensagem enviada
 */
async function processToolResult(result, toolName, context) {
  const { from, originalJid } = context;
  const sendTo = originalJid || from; // Prioriza o JID original se disponível
  let sentMessage = null;
  
  if (result.success) {
    // Verificar se a tool já enviou uma imagem (ex: cashflow com gráfico)
    if (result.sendImage) {
      // A tool já enviou a imagem, não precisa enviar mensagem de texto
      console.log(`📸 [AGENT-ROUTER] Tool ${toolName} já enviou imagem`);
      sentMessage = `[Gráfico de ${toolName} enviado]`; // Para memória
      return sentMessage;
    }
    
    // Tool executada com sucesso - enviar mensagem formatada
    if (result.message) {
      await sendWhatsAppText(sendTo, result.message);
      sentMessage = result.message;
    }
  } else {
    // Erro na execução da tool
    console.log(`❌ [AGENT-ROUTER] Erro na tool ${toolName}: ${result.error}`);
    
    if (result.error === "missing_params") {
      // Parâmetros faltando - pedir ao usuário
      sentMessage = result.message || "Preciso de mais algumas informações para continuar.";
      await sendWhatsAppText(sendTo, sentMessage);
    } else if (result.error === "no_bank" || result.error === "no_categories") {
      // Erro de configuração do usuário
      sentMessage = result.message;
      await sendWhatsAppText(sendTo, sentMessage);
    } else {
      // Erro genérico
      sentMessage = result.message || "Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente.";
      await sendWhatsAppText(sendTo, sentMessage);
    }
  }
  
  return sentMessage;
}

// Exportar também com o nome antigo para compatibilidade
export { handleWhatsAppMessageAgent as handleWhatsAppMessage };
