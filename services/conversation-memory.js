/**
 * Conversation Memory - Sistema de memória de conversa
 * 
 * Mantém histórico das últimas mensagens por usuário para
 * permitir conversas contextuais com o agente.
 */

// Armazenamento em memória das conversas
// Map<phoneNumber, { messages: Array, lastActivity: timestamp }>
const conversations = new Map();

// Configurações
const CONFIG = {
  MAX_MESSAGES: 10,           // Máximo de mensagens no histórico
  EXPIRY_MINUTES: 30,         // Tempo de expiração da conversa (minutos)
  CLEANUP_INTERVAL: 5 * 60000 // Intervalo de limpeza (5 minutos)
};

/**
 * Adiciona uma mensagem ao histórico da conversa
 * 
 * @param {string} phone - Número do telefone
 * @param {string} role - 'user' ou 'assistant'
 * @param {string} content - Conteúdo da mensagem
 */
export function addMessage(phone, role, content) {
  if (!phone || !content) return;
  
  const normalizedPhone = normalizePhone(phone);
  
  if (!conversations.has(normalizedPhone)) {
    conversations.set(normalizedPhone, {
      messages: [],
      lastActivity: Date.now()
    });
  }
  
  const conversation = conversations.get(normalizedPhone);
  const MAX_CONTENT = 300; // Limite de caracteres para log
  const storedContent = String(content).length > MAX_CONTENT ? String(content).substring(0, MAX_CONTENT) + '...' : content;
  // Adicionar mensagem
  conversation.messages.push({
    role,
    content: storedContent,
    timestamp: Date.now()
  });
  
  // Manter apenas as últimas N mensagens
  if (conversation.messages.length > CONFIG.MAX_MESSAGES) {
    conversation.messages = conversation.messages.slice(-CONFIG.MAX_MESSAGES);
  }
  
  // Atualizar timestamp de atividade
  conversation.lastActivity = Date.now();
  
  console.log(`💬 [MEMORY] ${role}: "${storedContent.substring(0, 50)}..." (${conversation.messages.length} msgs)`);
}

/**
 * Recupera o histórico de conversa formatado para o agente
 * 
 * @param {string} phone - Número do telefone
 * @returns {string} - Histórico formatado
 */
export function getConversationHistory(phone) {
  const normalizedPhone = normalizePhone(phone);
  const conversation = conversations.get(normalizedPhone);
  
  if (!conversation || conversation.messages.length === 0) {
    return "";
  }
  
  // Verificar se expirou
  const minutesSinceActivity = (Date.now() - conversation.lastActivity) / 60000;
  if (minutesSinceActivity > CONFIG.EXPIRY_MINUTES) {
    console.log(`⏰ [MEMORY] Conversa expirada para ${normalizedPhone}, limpando...`);
    conversations.delete(normalizedPhone);
    return "";
  }
  
  // Formatar histórico (excluindo a mensagem atual que será enviada separadamente)
  const history = conversation.messages.slice(0, -1); // Remove última (será a mensagem atual)
  
  if (history.length === 0) {
    return "";
  }
  
  const formatted = history.map(msg => {
    const roleLabel = msg.role === 'user' ? 'Usuário' : 'Assistente';
    return `${roleLabel}: ${msg.content}`;
  }).join('\n');

  const MAX_HISTORY_LENGTH = 2000; // Limite de caracteres para o histórico
  if (formatted.length > MAX_HISTORY_LENGTH) {
    return formatted.substring(formatted.length - MAX_HISTORY_LENGTH);
  }
  
  return formatted;
}

/**
 * Recupera as mensagens brutas da conversa
 * 
 * @param {string} phone - Número do telefone
 * @returns {Array} - Array de mensagens
 */
export function getMessages(phone) {
  const normalizedPhone = normalizePhone(phone);
  const conversation = conversations.get(normalizedPhone);
  
  if (!conversation) return [];
  
  return conversation.messages;
}

/**
 * Limpa o histórico de conversa de um usuário
 * 
 * @param {string} phone - Número do telefone
 */
export function clearConversation(phone) {
  const normalizedPhone = normalizePhone(phone);
  conversations.delete(normalizedPhone);
  console.log(`🧹 [MEMORY] Conversa limpa para ${normalizedPhone}`);
}

/**
 * Limpa conversas expiradas
 */
export function cleanupExpiredConversations() {
  const now = Date.now();
  const expiryMs = CONFIG.EXPIRY_MINUTES * 60000;
  let cleaned = 0;
  
  for (const [phone, conversation] of conversations.entries()) {
    if (now - conversation.lastActivity > expiryMs) {
      conversations.delete(phone);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 [MEMORY] Limpeza: ${cleaned} conversas expiradas removidas`);
  }
}

/**
 * Normaliza número de telefone
 */
function normalizePhone(phone) {
  return phone.replace(/\D/g, '');
}

/**
 * Retorna estatísticas de memória
 */
export function getStats() {
  return {
    activeConversations: conversations.size,
    config: CONFIG
  };
}

// Iniciar limpeza periódica
setInterval(cleanupExpiredConversations, CONFIG.CLEANUP_INTERVAL);

console.log('💾 [MEMORY] Sistema de memória de conversa inicializado');
