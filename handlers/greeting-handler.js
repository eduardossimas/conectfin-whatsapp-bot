/**
 * Handler de Saudações - Responde a cumprimentos e pedidos de ajuda
 */

import { sendWhatsAppText } from "../services/whatsapp-service.js";

/**
 * Processa saudações e pedidos de ajuda
 * 
 * @param {string} from - Número do remetente
 * @param {Object} user - Dados do usuário do banco
 * @param {Object} intentData - Dados da classificação de intenção
 */
export async function handleGreeting(from, user, intentData) {
  console.log(`👋 [GREETING] Processando saudação para ${user.nome || 'usuário'}`);
  
  const userName = user.nome ? user.nome.split(' ')[0] : 'amigo'; // Primeiro nome
  
  const greetingMessage = `Olá${userName !== 'amigo' ? ', ' + userName : ''}! 👋

Sou o assistente do ConectFin. Posso ajudar você a:

💰 *Registrar lançamentos*
• "Paguei R$ 50 de mercado"
• "Recebi R$ 1000 do cliente X"
• Envie foto de nota fiscal
• Envie áudio descrevendo a despesa

📊 *Visualizar relatórios*
• "Mostra o fluxo de caixa"
• "Ver DRE"
• "Contas a pagar"
• "Contas a receber"

Como posso ajudar você hoje? 😊`;

  await sendWhatsAppText(from, greetingMessage);
  console.log(`✅ [GREETING] Mensagem de boas-vindas enviada`);
}
