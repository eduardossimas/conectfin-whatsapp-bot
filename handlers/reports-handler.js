/**
 * Handler de Relatórios - Processa visualização de contas a pagar/receber
 */

import { 
  getContasAPagar, 
  getContasAReceber 
} from "../services/database-service.js";
import { sendWhatsAppText } from "../services/whatsapp-service-unified.js";
import { formatCurrency, formatDate } from "../utils/helpers.js";

/**
 * Processa visualização de contas a pagar
 * 
 * @param {string} from - Número do remetente
 * @param {Object} user - Dados do usuário do banco
 */
export async function handleViewPayables(from, user) {
  console.log(`💸 [PAYABLES] Buscando contas a pagar para usuário ${user.id}`);
  
  try {
    const contas = await getContasAPagar(user.id);
    
    if (!contas || contas.length === 0) {
      await sendWhatsAppText(
        from,
        "✅ *Contas a Pagar*\n\nParabéns! Você não tem despesas pendentes no momento. 🎉"
      );
      return;
    }
    
    // Calcular total
    const total = contas.reduce((sum, c) => sum + (Number(c.valor) || 0), 0);
    
    // Montar mensagem
    let message = `💸 *Contas a Pagar* (${contas.length})\n\n`;
    
    contas.forEach((conta, index) => {
      const vencimento = conta.data_vencimento 
        ? `Venc: ${formatDate(conta.data_vencimento)}`
        : "Sem vencimento";
      
      const categoria = conta.categorias?.nome || "Sem categoria";
      const banco = conta.bancos?.nome_banco || "N/A";
      
      message += `${index + 1}. ${conta.descricao}\n`;
      message += `   ${formatCurrency(conta.valor)} • ${vencimento}\n`;
      message += `   📂 ${categoria} • 🏦 ${banco}\n\n`;
    });
    
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `💰 *Total:* ${formatCurrency(total)}`;
    
    await sendWhatsAppText(from, message);
    console.log(`✅ [PAYABLES] Relatório enviado: ${contas.length} contas, total ${formatCurrency(total)}`);
    
  } catch (error) {
    console.error(`❌ [PAYABLES] Erro ao buscar contas a pagar:`, error);
    throw error;
  }
}

/**
 * Processa visualização de contas a receber
 * 
 * @param {string} from - Número do remetente
 * @param {Object} user - Dados do usuário do banco
 */
export async function handleViewReceivables(from, user) {
  console.log(`💰 [RECEIVABLES] Buscando contas a receber para usuário ${user.id}`);
  
  try {
    const contas = await getContasAReceber(user.id);
    
    if (!contas || contas.length === 0) {
      await sendWhatsAppText(
        from,
        "📊 *Contas a Receber*\n\nVocê não tem receitas pendentes no momento."
      );
      return;
    }
    
    // Calcular total
    const total = contas.reduce((sum, c) => sum + (Number(c.valor) || 0), 0);
    
    // Montar mensagem
    let message = `💰 *Contas a Receber* (${contas.length})\n\n`;
    
    contas.forEach((conta, index) => {
      const vencimento = conta.data_vencimento 
        ? `Venc: ${formatDate(conta.data_vencimento)}`
        : "Sem vencimento";
      
      const categoria = conta.categorias?.nome || "Sem categoria";
      const banco = conta.bancos?.nome_banco || "N/A";
      
      message += `${index + 1}. ${conta.descricao}\n`;
      message += `   ${formatCurrency(conta.valor)} • ${vencimento}\n`;
      message += `   📂 ${categoria} • 🏦 ${banco}\n\n`;
    });
    
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `💰 *Total:* ${formatCurrency(total)}`;
    
    await sendWhatsAppText(from, message);
    console.log(`✅ [RECEIVABLES] Relatório enviado: ${contas.length} contas, total ${formatCurrency(total)}`);
    
  } catch (error) {
    console.error(`❌ [RECEIVABLES] Erro ao buscar contas a receber:`, error);
    throw error;
  }
}
