/**
 * Handler de Transações - Processa criação de lançamentos financeiros
 */

import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { 
  getBancoIdPadrao, 
  getAllUserCategorias, 
  createLancamento
} from "../services/database-service.js";
import { findBestCategory } from "../services/ai-service.js";
import { sendWhatsAppText } from "../services/whatsapp-service-unified.js";
import { formatCurrency, formatDate } from "../utils/helpers.js";
import { 
  analyzeInlineAudio, 
  analyzeInlineImage, 
  analyzeInlinePdf 
} from "../analyzers/media-analyzer.js";
import { analyzeFreeText } from "../analyzers/text-analyzer.js";

// Configurar timezone
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Processa criação de transação financeira
 * 
 * @param {string} from - Número do remetente
 * @param {Object} user - Dados do usuário do banco
 * @param {Object} message - Mensagem parseada do Baileys
 */
export async function handleCreateTransaction(from, user, message) {
  console.log(`💰 [TRANSACTION] Processando criação de transação para usuário ${user.id}`);
  
  const { type, text, caption, media } = message;
  
  try {
    // ============ 1. ANÁLISE COM IA ============
    console.log(`🤖 [TRANSACTION] Iniciando análise com IA - Tipo: ${type}`);
    
    let parsed_data;
    
    if (type === 'text') {
      console.log(`📝 [TRANSACTION] Analisando texto: "${text}"`);
      parsed_data = await analyzeFreeText(text);
    } else if (type === 'image' && media) {
      console.log(`🖼️ [TRANSACTION] Analisando imagem`);
      parsed_data = await analyzeInlineImage({
        buffer: media.buffer,
        mime: media.mimetype,
        caption: caption || text
      });
    } else if (type === 'audio' && media) {
      console.log(`🎵 [TRANSACTION] Analisando áudio`);
      parsed_data = await analyzeInlineAudio({
        buffer: media.buffer,
        mime: media.mimetype
      });
    } else if (type === 'document' && media) {
      if (media.mimetype.includes('pdf')) {
        console.log(`📄 [TRANSACTION] Analisando PDF`);
        parsed_data = await analyzeInlinePdf({ buffer: media.buffer });
      } else {
        console.log(`📄 [TRANSACTION] Documento não-PDF, analisando como texto`);
        parsed_data = await analyzeFreeText(caption || text || "Documento enviado");
      }
    } else {
      console.log(`❌ [TRANSACTION] Tipo de mensagem não suportado: ${type}`);
      await sendWhatsAppText(
        from,
        "❌ Tipo de mensagem não suportado. Envie texto, imagem, áudio ou PDF com informações do lançamento."
      );
      return;
    }

    console.log(`✅ [TRANSACTION] Análise concluída:`, JSON.stringify(parsed_data, null, 2));

    // ============ 2. NORMALIZAÇÃO & DEFAULTS ============
    console.log(`🔧 [TRANSACTION] Normalizando dados extraídos`);
    
    const today = dayjs.tz(dayjs(), "America/Sao_Paulo").format("YYYY-MM-DD");
    const payloadOut = {
      tipo: parsed_data.tipo_lancamento || "despesa",
      descricao: parsed_data.descricao || (caption || text || "").slice(0, 140),
      valor: parsed_data.valor != null ? Number(parsed_data.valor) : null,
      data_competencia: parsed_data.data_competencia || today,
      data_pagamento: parsed_data.data_pagamento || null,
      data_vencimento: parsed_data.data_vencimento || null,
      categoria_sugerida: parsed_data.categoria_sugerida || null,
      needs_fix: parsed_data.needs_fix || false,
      confidence: parsed_data.confidence || 0.0,
    };

    console.log(`✅ [TRANSACTION] Dados normalizados:`, JSON.stringify(payloadOut, null, 2));

    // ============ 3. VERIFICAR SE PRECISA DE CORREÇÃO ============
    if (payloadOut.needs_fix) {
      console.log(`⚠️ [TRANSACTION] Transação precisa de correção. Missing:`, parsed_data.missing);
      console.log(`💡 [TRANSACTION] Sugestões:`, parsed_data.suggestions);
      
      let errorMessage = `❌ Informações incompletas!\n\nFaltando: ${parsed_data.missing?.join(', ')}\n\nSugestão: ${parsed_data.suggestions?.join(' ')}\n\nTente novamente com mais detalhes.`;
      
      // Se foi um documento, adiciona contexto específico
      if (type === "document") {
        errorMessage = `📄 Documento processado, mas faltam informações:\n\n❌ Faltando: ${parsed_data.missing?.join(', ')}\n\n💡 ${parsed_data.suggestions?.join(' ')}\n\nVocê pode:\n• Reenviar um documento mais claro\n• Digitar as informações manualmente`;
      }
      
      await sendWhatsAppText(from, errorMessage);
      return;
    }

    // ============ 4. BUSCAR BANCO PADRÃO ============
    console.log(`🏦 [TRANSACTION] Buscando banco padrão do usuário...`);
    const id_banco = await getBancoIdPadrao(user.id);
    console.log(`✅ [TRANSACTION] Banco padrão ID: ${id_banco}`);

    if (!id_banco) {
      console.log(`❌ [TRANSACTION] Usuário sem banco configurado`);
      await sendWhatsAppText(
        from,
        "❌ Você ainda não tem nenhum banco configurado no ConectFin.\n\nPor favor:\n1. Acesse o sistema\n2. Cadastre pelo menos um banco\n3. Defina um como principal (opcional)\n\nApós isso, pode usar o WhatsApp normalmente! 🙂"
      );
      return;
    }

    // ============ 5. BUSCAR CATEGORIAS ============
    console.log(`📂 [TRANSACTION] Buscando todas as categorias do tipo: ${payloadOut.tipo}`);
    const allCategorias = await getAllUserCategorias(user.id, payloadOut.tipo);
    console.log(`✅ [TRANSACTION] Encontradas ${allCategorias.length} categorias:`, 
      allCategorias.map(c => `${c.id}: ${c.nome}`).join(', '));

    // ============ 6. IA ESCOLHE A MELHOR CATEGORIA ============
    console.log(`🤖 [TRANSACTION] Solicitando à IA para escolher melhor categoria...`);
    const nomeCategoria = await findBestCategory(payloadOut.categoria_sugerida, allCategorias);
    
    // Encontrar ID da categoria pelo nome
    const categoriaEscolhida = allCategorias.find(cat => 
      cat.nome.toLowerCase() === nomeCategoria?.toLowerCase()
    );
    
    const id_categoria = categoriaEscolhida?.id || allCategorias[0]?.id || null;
    console.log(`✅ [TRANSACTION] IA escolheu categoria: ${nomeCategoria} (ID: ${id_categoria})`);

    // ============ 7. CRIAR LANÇAMENTO ============
    console.log(`💾 [TRANSACTION] Criando lançamento...`);

    const lanc = await createLancamento({
      user_id: user.id,
      tipo: payloadOut.tipo,
      descricao: payloadOut.descricao,
      valor: payloadOut.valor,
      data_competencia: payloadOut.data_competencia,
      data_pagamento: payloadOut.data_pagamento,
      data_vencimento: payloadOut.data_vencimento,
      banco_id: id_banco,
      categoria_id: id_categoria,
    });

    console.log(`✅ [TRANSACTION] Lançamento criado com ID: ${lanc.id}`);

    // ============ 8. MENSAGEM DE CONFIRMAÇÃO ============
    console.log(`📤 [TRANSACTION] Preparando mensagem de confirmação`);
    
    const confirm = [
      `✅ Lançamento criado!`,
      ``,
      `• *Tipo:* ${payloadOut.tipo === 'receita' ? '💰 Receita' : '💸 Despesa'}`,
      `• *Descrição:* ${payloadOut.descricao || "-"}`,
      `• *Valor:* ${payloadOut.valor !== null ? formatCurrency(payloadOut.valor) : "(sem valor)"}`,
      `• *Data:* ${formatDate(payloadOut.data_competencia)}`,
      payloadOut.data_pagamento ? `• *Data pagamento:* ${formatDate(payloadOut.data_pagamento)}` : null,
      payloadOut.data_vencimento ? `• *Data vencimento:* ${formatDate(payloadOut.data_vencimento)}` : null,
      `• *Categoria:* ${categoriaEscolhida?.nome || `#${id_categoria}`}`,
      ``,
      `_ID: ${lanc.id}_`,
    ].filter(Boolean).join("\n");

    console.log(`📤 [TRANSACTION] Enviando confirmação`);
    await sendWhatsAppText(from, confirm);
    console.log(`✅ [TRANSACTION] Confirmação enviada com sucesso!`);
    
  } catch (error) {
    console.error(`❌ [TRANSACTION] Erro ao processar transação:`, error);
    throw error; // Relança para o handler principal tratar
  }
}
