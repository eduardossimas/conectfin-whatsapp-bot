/**
 * Executores das Tools - Implementação real das ações
 * Cada tool chama os services necessários e retorna resultado formatado
 */

import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import isBetween from "dayjs/plugin/isBetween.js";
import 'dayjs/locale/pt-br.js';
import dbService from "../services/database-service.js";
import { 
  getBancoIdPadrao, 
  getAllUserCategorias,
  getLancamentosParaFluxoCaixa
} from "../services/database-service.js";
import { findBestCategory } from "../services/ai-service.js";
import { formatCurrency, formatDate } from "../utils/helpers.js";
import { validateToolParams, getMissingParamsMessage } from "./definitions.js";
import { gerarGraficoFluxoCaixa } from "../services/chart-service-svg.js";
import { sendWhatsAppImage } from "../services/whatsapp-service-unified.js";
import { setPending, getPendingWithMerge, clearPending, setPendingChoice, getPendingChoice, clearPendingChoice } from "../services/pending-transaction.js";

// Configurar dayjs com plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);
dayjs.locale('pt-br');

/**
 * Executor principal - roteia para a função correta
 * 
 * @param {string} toolName - Nome da tool
 * @param {Object} params - Parâmetros da tool
 * @param {Object} context - Contexto (user, from, etc)
 * @returns {Promise<{ success: boolean, data?: any, error?: string, message?: string, sendImage?: boolean }>}
 */
export async function executeTool(toolName, params, context) {
  console.log(`🔧 [TOOL-EXECUTOR] Executando tool: ${toolName}`);
  console.log(`📦 [TOOL-EXECUTOR] Parâmetros:`, JSON.stringify(params, null, 2));
  
  // Validar parâmetros antes de executar
  const validation = validateToolParams(toolName, params);
  
  if (!validation.valid) {
    console.log(`⚠️ [TOOL-EXECUTOR] Validação falhou:`, validation);
    
    if (validation.missing.length > 0) {
      return {
        success: false,
        error: "missing_params",
        missing: validation.missing,
        message: getMissingParamsMessage(toolName, validation.missing)
      };
    }
    
    return {
      success: false,
      error: "validation_error",
      errors: validation.errors,
      message: `Erro de validação: ${validation.errors.join(", ")}`
    };
  }
  
  // Rotear para executor específico
  const executors = {
    create_transaction: executeCreateTransaction,
    get_payables: executeGetPayables,
    get_receivables: executeGetReceivables,
    get_cashflow: executeGetCashflow,
    list_transactions: executeListTransactions,
    analyze_cashflow: executeAnalyzeCashflow,
    pay_transaction: executePayTransaction,
  };
  
  const executor = executors[toolName];
  
  if (!executor) {
    return {
      success: false,
      error: "unknown_tool",
      message: `Tool "${toolName}" não existe ou não está implementada`
    };
  }
  
  try {
    const result = await executor(params, context);
    console.log(`✅ [TOOL-EXECUTOR] Tool ${toolName} executada com sucesso`);
    return result;
  } catch (error) {
    console.error(`❌ [TOOL-EXECUTOR] Erro ao executar ${toolName}:`, error.message);
    return {
      success: false,
      error: "execution_error",
      message: `Erro ao executar: ${error.message}`
    };
  }
}

// ========================= EXECUTORES ESPECÍFICOS =========================

/**
 * Cria um lançamento financeiro, mas antes confirma o lançamento com o usuário
 */
async function executeCreateTransaction(params, context) {
  const { user } = context;

  //============ SE CONFIRMADO: executa pendente =============
  if(params.confirmada){
    const merged = getPendingWithMerge(user.id, params);
    clearPending(user.id);
    if(!merged){
      return {
        success: false,
        error: "no_pending",
        message: "Não há transações pendentes para confirmar. Por favor, inicie uma nova transação."
      };
    }
    return await actuallyCreateTransaction(merged, context);
  }

  // Normalizar dados
  const today = dayjs.tz(dayjs(), "America/Sao_Paulo").format("YYYY-MM-DD");
  const tipo = params.tipo; // "receita" ou "despesa"
  const descricao = params.descricao;
  const valor = Number(params.valor);
  const data_vencimento = params.data_vencimento || today;

  //============ PRIMEIRA CHAMADA: salva como pendente e retorna a preview =============  
  const tipoEmoji = tipo === "receita" ? "💚" : "🔴";
  const tipoLabel = tipo === "receita" ? "Receita" : "Despesa";
  const valorFormatado = formatCurrency(valor);
  const dataFormatada = formatDate(data_vencimento);

  const previewMsg = `${tipoEmoji} *Vou registrar*
 ${descricao}
💰 ${valorFormatado}
📅 Data: ${dataFormatada}
🕒 Confirma o lançamento?`;

  setPending(user.id, params);

  return { success: true, message: previewMsg};
}

async function actuallyCreateTransaction(params, context) {
  const { user } = context;

  const tipo = params.tipo; // "receita" ou "despesa"
  const descricao = params.descricao;
  const valor = Number(params.valor);
  const data_competencia = params.data_competencia || dayjs.tz(dayjs(), "America/Sao_Paulo").format("YYYY-MM-DD");
  const data_pagamento = params.data_pagamento || null;
  const data_vencimento = params.data_vencimento || null;

  // Buscar banco padrão
  const id_banco = await getBancoIdPadrao(user.id);
  
  if (!id_banco) {
    return {
      success: false,
      error: "no_bank",
      message: "Você ainda não tem nenhum banco configurado no ConectFin. Por favor, acesse o sistema e cadastre pelo menos um banco."
    };
  }
  
  // Buscar categorias
  const allCategorias = await getAllUserCategorias(user.id, tipo);
  
  if (!allCategorias || allCategorias.length === 0) {
    return {
      success: false,
      error: "no_categories",
      message: `Você não tem categorias de ${tipo} cadastradas. Por favor, acesse o ConectFin e cadastre algumas categorias.`
    };
  }
  
  // Assistente escolhe melhor categoria
  let id_categoria = allCategorias[0]?.id;
  
  if (params.categoria_sugerida) {
    const nomeCategoria = await findBestCategory(params.categoria_sugerida, allCategorias);
    const categoriaEscolhida = allCategorias.find(cat => 
      cat.nome.toLowerCase() === nomeCategoria?.toLowerCase()
    );
    if (categoriaEscolhida) {
      id_categoria = categoriaEscolhida.id;
    }
  }
  
  const categoriaUsada = allCategorias.find(c => c.id === id_categoria);
  
  // Criar lançamento
  const lancamento = await dbService.createTransaction(user.id, {
    tipo_lancamento: tipo,
    descricao: descricao,
    valor_lancamento: valor,
    data_competencia: data_competencia,
    data_pagamento: data_pagamento,
    data_vencimento: data_vencimento,
    id_banco: id_banco,
    id_categoria: id_categoria
  });
  
  let statusPagamento = "";
  if (data_pagamento) {
    statusPagamento = tipo === "receita" ? "✅ Recebido" : "✅ Pago";
  } else if (data_vencimento) {
    statusPagamento = `📅 Vence em ${formatDate(data_vencimento)}`;
  } else {
    statusPagamento = "⏳ Pendente";
  }
  
  const tipoEmoji = tipo === "receita" ? "💚" : "🔴";
  const tipoLabel = tipo === "receita" ? "Receita" : "Despesa";
  const valorFormatado = formatCurrency(valor);
  const dataFormatada = formatDate(data_competencia);

  const message = `${tipoEmoji} *${tipoLabel} registrada!*

📝 ${descricao}
💰 ${valorFormatado}
📅 ${dataFormatada}
📂 ${categoriaUsada?.nome || "Categoria"}
${statusPagamento}`;
  
  return {
    success: true,
    data: {
      id: lancamento.id,
      tipo,
      descricao,
      valor,
      categoria: categoriaUsada?.nome
    },
    message
  };
}

/**
 * Lista contas a pagar (despesas pendentes)
 */
async function executeGetPayables(params, context) {
  const { user } = context;
  const limit = params.limit || 20;
  
  // Buscar despesas sem data_pagamento
  const transactions = await dbService.getTransactions(user.id, {
    type: 'despesa',
    limit: 100
  });
  
  // Filtrar apenas pendentes (sem data_pagamento) E que sejam despesas
  const pendentes = transactions.filter(t => !t.data_pagamento && t.tipo_lancamento === 'despesa');
  
  if (!pendentes || pendentes.length === 0) {
    return {
      success: true,
      data: { count: 0, items: [] },
      message: "🎉 Ótima notícia! Você não tem contas a pagar no momento."
    };
  }
  
  // Calcular total
  const total = pendentes.reduce((sum, t) => sum + Number(t.valor || 0), 0);
  
  // Formatar lista
  const lista = pendentes.slice(0, 10).map((t, i) => {
    const vencimento = t.data_vencimento ? formatDate(t.data_vencimento) : "Sem vencimento";
    const valor = formatCurrency(t.valor);
    const atrasado = t.data_vencimento && dayjs(t.data_vencimento).isBefore(dayjs()) ? "⚠️" : "";
    return `${i + 1}. ${atrasado}${t.descricao} - ${valor} (${vencimento})`;
  }).join("\n");
  
  const message = `📋 *Contas a Pagar*

${lista}
${pendentes.length > 10 ? `\n... e mais ${pendentes.length - 10} contas` : ""}

💰 *Total:* ${formatCurrency(total)}`;
  
  return {
    success: true,
    data: { 
      count: pendentes.length, 
      total,
      items: pendentes 
    },
    message
  };
}

/**
 * Lista contas a receber (receitas pendentes)
 */
async function executeGetReceivables(params, context) {
  const { user } = context;
  const limit = params.limit || 20;
  
  // Buscar receitas sem data_pagamento
  const transactions = await dbService.getTransactions(user.id, {
    type: 'receita',
    limit: 100
  });
  
  // Filtrar apenas pendentes (sem data_pagamento) E que sejam receitas
  const pendentes = transactions.filter(t => !t.data_pagamento && t.tipo_lancamento === 'receita');
  
  if (!pendentes || pendentes.length === 0) {
    return {
      success: true,
      data: { count: 0, items: [] },
      message: "📭 Você não tem contas a receber pendentes no momento."
    };
  }
  
  // Calcular total
  const total = pendentes.reduce((sum, t) => sum + Number(t.valor || 0), 0);
  
  // Formatar lista
  const lista = pendentes.slice(0, 10).map((t, i) => {
    const vencimento = t.data_vencimento ? formatDate(t.data_vencimento) : "Sem vencimento";
    const valor = formatCurrency(t.valor);
    return `${i + 1}. ${t.descricao} - ${valor} (${vencimento})`;
  }).join("\n");
  
  const message = `📋 *Contas a Receber*

${lista}
${pendentes.length > 10 ? `\n... e mais ${pendentes.length - 10} contas` : ""}

💰 *Total a receber:* ${formatCurrency(total)}`;
  
  return {
    success: true,
    data: { 
      count: pendentes.length, 
      total,
      items: pendentes 
    },
    message
  };
}

/**
 * Gera fluxo de caixa COM GRÁFICO
 */
async function executeGetCashflow(params, context) {
  const { user, from, originalJid } = context;
  const sendTo = originalJid || from;
  
  // Determinar período
  const today = dayjs.tz(dayjs(), "America/Sao_Paulo");
  let mesInicio = today.startOf("month");
  let mesFim = today.endOf("month");
  
  // Se passou período específico, tentar interpretar
  if (params.periodo) {
    const periodoExtraido = extrairPeriodoDaMensagem(params.periodo);
    if (periodoExtraido) {
      mesInicio = periodoExtraido.mesInicio;
      mesFim = periodoExtraido.mesFim;
    }
  }
  
  if (params.start_date) mesInicio = dayjs(params.start_date).startOf("day");
  if (params.end_date) mesFim = dayjs(params.end_date).endOf("day");
  
  const periodo = { mesInicio, mesFim };
  const periodoLabel = mesInicio.format("MMMM/YYYY");
  
  console.log(`📊 [CASHFLOW-TOOL] Gerando fluxo de caixa para ${periodoLabel}`);
  
  // Buscar dados
  const { lancamentos, bancos } = await getLancamentosParaFluxoCaixa(user.id, mesFim.format("YYYY-MM-DD"));
  
  console.log(`📊 [CASHFLOW-TOOL] ${lancamentos.length} lançamentos, ${bancos.length} bancos`);
  
  // Verificar se há dados
  if (lancamentos.length === 0) {
    return {
      success: true,
      data: { count: 0 },
      message: `📊 *Fluxo de Caixa - ${periodoLabel}*\n\nNão foram encontrados lançamentos neste período.`
    };
  }
  
  // Filtrar lançamentos do mês
  const lancamentosMes = lancamentos.filter(l => {
    const data = l.data_pagamento 
      ? dayjs(l.data_pagamento).tz('America/Sao_Paulo')
      : dayjs(l.data_competencia).tz('America/Sao_Paulo');
    return data.isSame(mesInicio, 'month') && data.isSame(mesInicio, 'year');
  });
  
  // Calcular totais
  let receitas = 0;
  let despesas = 0;
  
  lancamentosMes.forEach(lanc => {
    const valor = parseFloat(lanc.valor || 0);
    if (lanc.tipo_lancamento === 'receita' || lanc.tipo_lancamento === 'income') {
      receitas += valor;
    } else if (lanc.tipo_lancamento === 'despesa' || lanc.tipo_lancamento === 'expense') {
      despesas += valor;
    }
  });
  
  const saldo = receitas - despesas;
  const saldoEmoji = saldo >= 0 ? "✅" : "❌";
  const saldoTexto = saldo >= 0 ? "Positivo" : "Negativo";
  
  // Gerar gráfico
  console.log('📈 [CASHFLOW-TOOL] Gerando gráfico...');
  let graficoBuffer;
  try {
    graficoBuffer = await gerarGraficoFluxoCaixa(lancamentos, periodo, bancos, null);
    console.log('✅ [CASHFLOW-TOOL] Gráfico gerado com sucesso');
  } catch (chartError) {
    console.error('❌ [CASHFLOW-TOOL] Erro ao gerar gráfico:', chartError.message);
    // Retornar apenas texto se falhar gráfico
    return {
      success: true,
      data: { receitas, despesas, saldo, transacoes: lancamentosMes.length },
      message: `📊 *Fluxo de Caixa - ${periodoLabel}*\n\n💚 Receitas: ${formatCurrency(receitas)}\n🔴 Despesas: ${formatCurrency(despesas)}\n${saldoEmoji} Saldo: ${formatCurrency(Math.abs(saldo))} (${saldoTexto})\n\n📈 Total de lançamentos: ${lancamentosMes.length}`
    };
  }
  
  // Montar mensagem de resumo
  const message = `📊 *Fluxo de Caixa - ${periodoLabel}*

💰 *Resumo Financeiro:*
├─ 💚 Receitas: ${formatCurrency(receitas)}
├─ 💸 Despesas: ${formatCurrency(despesas)}
└─ ${saldoEmoji} Saldo: ${formatCurrency(Math.abs(saldo))} (${saldoTexto})

📈 Total de lançamentos: ${lancamentosMes.length}

_Gráfico gerado em ${dayjs().tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm')}_`;
  
  // Enviar imagem diretamente (a tool envia a imagem)
  if (sendTo && graficoBuffer) {
    await sendWhatsAppImage(sendTo, graficoBuffer, message);
  }
  
  return {
    success: true,
    sendImage: true, // Flag para indicar que já enviou imagem
    data: {
      periodo: periodoLabel,
      receitas,
      despesas,
      saldo,
      transacoes: lancamentosMes.length
    },
    message: null // Não enviar mensagem de texto, já enviou imagem
  };
}

export async function executePayTransaction(params, context) {
  const { user } = context;

  const descricao = params.descricao;
  const tipo = params.tipo || null;
  const valor = params.valor != null ? Number(params.valor) : null;
  const data_pagamento = params.data_pagamento || dayjs.tz(dayjs(), "America/Sao_Paulo").format("YYYY-MM-DD");


  // === RAMO DE ESCOLHA (usuário respondeu um número) ===
  if (params.indice != null) {
    const candidatos = getPendingChoice(user.id);
    if (!candidatos) {
      return { success: false, error: "no_pending_choice",
        message: "Já não tenho essa lista aqui. Me diga de novo qual conta você pagou." };
    }

    const alvo = candidatos[params.indice - 1];
    if (!alvo) {
      return { success: false, error: "invalid_indice",
        message: `Escolha um número entre 1 e ${candidatos.length}.` };
    }
    if (alvo.criarNova) {
      clearPendingChoice(user.id);
      return {
        success: false,
        error: "create_new_request",
        descricao: alvo.descricao,
        tipo: tipo,
        message: `Certo! Vou iniciar a criação da nova conta "${alvo.descricao}".`
      };
    }
    const aindaPendente = await verificarAindaPendente(user.id, alvo.id);
    clearPendingChoice(user.id);
    if (!aindaPendente) {
      return { success: false, error: "already_paid",
        message: `A conta "${alvo.descricao}" já consta como paga no sistema.` };
    }
    return marcarComoPaga(alvo, user.id, data_pagamento);
}
  
  // Buscar transação pendente correspondente
  const transactions = await dbService.getTransactions(user.id, { limit: 100 });
  const pendentes = (transactions || []).filter(t => {
    if (t.data_pagamento) return false; // Já paga
    if(tipo && t.tipo_lancamento !== tipo) return false;
    return true;});

  if (pendentes.length === 0) {
    return {
      success: false,
      error: "no_pending",
      message: "Não há transações pendentes para pagar. Quer que eu crie uma nova transação?"
    };
  }

  // Normalizar descrição para busca e pontuar cada candidato por similaridade
  const alvo = normalizarTexto(descricao);
  const scored = pendentes
  .map(t => ({ t, score: calcularScore(t, alvo, valor) }))
  .sort((a,b) => b.score-a.score);

  const melhor=scored[0];

  //Sem candidatos com bom score, sugerir nova transação
  if(melhor.score < 0.4){
    const lista = pendentes.slice(0, 5).map((t, i) =>
      `${i + 1}. ${t.descricao} - ${formatCurrency(t.valor)}${t.data_vencimento ? ` (vence ${formatDate(t.data_vencimento)})` : ''}`).join("\n");
    const criarIndice = pendentes.length + 1;
    setPendingChoice(user.id, [...pendentes, { criarNova: true, descricao }]);
    return {
      success: false,
      error: "no_match",
      message: `Não encontrei nenhuma pendente com "${descricao}".\n\nSuas contas a pagar:\n${lista}\n${criarIndice}. ✨ Criar nova transação "${descricao}"\n\nResponda com o número correspondente.`
    };
  }

  // Perguntar sobre candidatos parecidos
  const empatados = scored.filter(s => s.score >= 0.4 && Math.abs(s.score - melhor.score) < 0.05);
  if (empatados.length > 1) {
    const lista = empatados.slice (0, 5).map((s, i) => 
      `${i + 1}. ${s.t.descricao} - ${formatCurrency(s.t.valor)}${s.t.data_vencimento ? ` (vence ${formatDate(s.t.data_vencimento)})` : ''}`).join("\n");
    setPendingChoice(user.id, empatados.map(s => s.t));
    return {
      success: false,
      error: "multiple_matches",
      message: `Encontrei mais de uma transação que combina com "${descricao}":\n\n${lista}\n
      \nQual delas você quer pagar? Responda com o número correspondente (1-${empatados.length})`
    };
  }

  //Caso de match único, marcar como pago
  const alvoTransacao = melhor.t;
  await dbService.updateTransaction(alvoTransacao.id, user.id, {
    id_banco: alvoTransacao.id_banco, 
    id_categoria: alvoTransacao.id_categoria, 
    descricao: alvoTransacao.descricao, 
    valor: Number(alvoTransacao.valor),
    tipo_lancamento: alvoTransacao.tipo_lancamento,
    data_competencia: alvoTransacao.data_competencia,
    data_lancamento: alvoTransacao.data_lancamento,
    data_vencimento: alvoTransacao.data_vencimento,
    data_pagamento: data_pagamento
  });

  const ehReceita = alvoTransacao.tipo_lancamento === 'receita';
  const verbo = ehReceita ? 'Recebida' : 'Paga';
  const emoji = ehReceita ? '💚' : '🔴';

  return marcarComoPaga(alvoTransacao, user, data_pagamento);
}

async function marcarComoPaga(transacao, userID, data_pagamento) {
  await dbService.updateTransaction(transacao.id, userID, {
    id_banco: transacao.id_banco,
    id_categoria: transacao.id_categoria,
    descricao: transacao.descricao,
    valor: Number(transacao.valor),
    tipo_lancamento: transacao.tipo_lancamento,
    data_competencia: transacao.data_competencia,
    data_lancamento: transacao.data_lancamento,
    data_vencimento: transacao.data_vencimento,
    data_pagamento: data_pagamento
  });

  const ehReceita = transacao.tipo_lancamento === 'receita';
  const verbo = ehReceita ? 'Recebida' : 'Paga';
  const emoji = ehReceita ? '💚' : '🔴';

  return {
    success: true,
    data: {id: transacao.id, descricao: transacao.descricao, valor: transacao.valor, data_pagamento: data_pagamento},
    message: `${emoji} *${transacao.descricao}* marcada como ${verbo} em ${formatDate(data_pagamento)}.\n
    \nEla não aparece mais em ${ehReceita ? "contas a receber" : "contas a pagar"}.`
  };
}

async function verificarAindaPendente(userID, transactionID) {
  const transactions = await dbService.getTransactions(userID, {limit: 100});
  return (transactions || []).some(t => t.id === transactionID && !t.data_pagamento);
}

function calcularScore(transacao, alvo, valor) {
  const desc = normalizarTexto(transacao.descricao);
  if (!desc || !alvo) return 0;
  if (desc === alvo) return 1;
  if (desc.includes(alvo) || alvo.includes(desc)) return 0.9;
  
  //Palavras padrões para evitar match falho
  const stopwords = new Set(["conta","de","da","do","das","pagar","paguei","pagamento","valor","hoje","agora","minhas","minha","o","a","em","para"]);
  const tokenAlvo = alvo.split(' ').filter(t => t.length > 2 && !stopwords.has(t));
  const tokenDesc = desc.split(' ').filter(t => t.length > 2 && !stopwords.has(t));
  if (tokenAlvo.length === 0) return 0;

  const iguais = tokenAlvo.filter(t => tokenDesc.includes(t)).length;
  let score = iguais / tokenAlvo.length;

  if(valor != null && transacao.valor != null){
    if(Math.abs(transacao.valor - valor) < 0.01) score += 0.25;
    else if (score > 0.5) score -= 0.2;
  }
  return Math.min(score, 1);
}

/**
 * Extrai período de uma mensagem em linguagem natural
 */
function extrairPeriodoDaMensagem(mensagem) {
  if (!mensagem) return null;
  
  const texto = mensagem.toLowerCase().trim();
  let dataBase = dayjs().tz('America/Sao_Paulo');
  
  // Meses em português
  const mesesNomes = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  
  for (let i = 0; i < mesesNomes.length; i++) {
    const nomeMes = mesesNomes[i];
    if (texto.includes(nomeMes)) {
      // Tentar encontrar ano
      const regexAno = new RegExp(`${nomeMes}\\s*(?:de\\s*)?(\\d{4})`, 'i');
      const matchAno = texto.match(regexAno);
      
      if (matchAno && matchAno[1]) {
        const ano = parseInt(matchAno[1]);
        dataBase = dayjs().tz('America/Sao_Paulo').year(ano).month(i).date(1);
      } else {
        dataBase = dayjs().tz('America/Sao_Paulo').month(i).date(1);
      }
      
      return {
        mesInicio: dataBase.startOf('month'),
        mesFim: dataBase.endOf('month')
      };
    }
  }
  
  // Tentar formato numérico (MM/YYYY)
  const regexNumerico = /(\d{1,2})[\/-](\d{4})/;
  const matchNumerico = texto.match(regexNumerico);
  
  if (matchNumerico) {
    const mes = parseInt(matchNumerico[1]);
    const ano = parseInt(matchNumerico[2]);
    
    if (mes >= 1 && mes <= 12) {
      dataBase = dayjs().tz('America/Sao_Paulo').year(ano).month(mes - 1).date(1);
      return {
        mesInicio: dataBase.startOf('month'),
        mesFim: dataBase.endOf('month')
      };
    }
  }
  
  // Verificar "mês passado", "último mês"
  if (texto.includes('mês passado') || texto.includes('último mês') || texto.includes('mes passado')) {
    dataBase = dayjs().tz('America/Sao_Paulo').subtract(1, 'month');
    return {
      mesInicio: dataBase.startOf('month'),
      mesFim: dataBase.endOf('month')
    };
  }
  
  return null; // Usar mês atual
}

/**
 * Analisa fluxo de caixa com insights
 */
async function executeAnalyzeCashflow(params, context) {
  const { user } = context;
  
  // Primeiro, buscar os dados do fluxo
  const cashflowResult = await executeGetCashflow(params, context);
  
  if (!cashflowResult.success) {
    return cashflowResult;
  }
  
  const { receitas, despesas, saldo, transacoes } = cashflowResult.data;
  
  // Gerar insights
  const insights = [];
  
  // Análise do saldo
  if (saldo < 0) {
    insights.push("⚠️ *Atenção:* Suas despesas estão maiores que suas receitas neste período. Considere revisar gastos não essenciais.");
  } else if (saldo > 0 && receitas > 0) {
    const taxaPoupanca = ((saldo / receitas) * 100).toFixed(1);
    if (taxaPoupanca >= 20) {
      insights.push(`✨ *Excelente!* Você está guardando ${taxaPoupanca}% da sua receita. Continue assim!`);
    } else if (taxaPoupanca >= 10) {
      insights.push(`👍 *Bom!* Você está guardando ${taxaPoupanca}% da sua receita. Tente aumentar para 20%.`);
    } else {
      insights.push(`💡 *Dica:* Você está guardando apenas ${taxaPoupanca}% da sua receita. O ideal é pelo menos 20%.`);
    }
  }
  
  // Análise de volume de transações
  if (transacoes < 5) {
    insights.push("📝 *Poucos lançamentos este mês.* Lembre-se de registrar todas as suas movimentações para ter uma visão completa.");
  }
  
  // Proporção despesas/receitas
  if (receitas > 0) {
    const proporcao = (despesas / receitas) * 100;
    if (proporcao > 90) {
      insights.push("🔍 *Análise:* Suas despesas representam mais de 90% da sua receita. Considere criar um orçamento para controlar melhor os gastos.");
    }
  }
  
  const message = `📊 *Análise do Fluxo de Caixa*

${cashflowResult.message}

---

*💡 Insights:*

${insights.length > 0 ? insights.join("\n\n") : "✅ Suas finanças parecem equilibradas. Continue acompanhando regularmente!"}

---

*Dicas gerais:*
• Registre todos os gastos, mesmo os pequenos
• Revise suas categorias mensalmente
• Estabeleça metas de economia`;
  
  return {
    success: true,
    data: {
      ...cashflowResult.data,
      insights
    },
    message
  };
}

/**
 * Lista lançamentos detalhados do período
 */
async function executeListTransactions(params, context) {
  const { user } = context;
  
  // Determinar período
  const today = dayjs.tz(dayjs(), "America/Sao_Paulo");
  let startDate = today.startOf("month").format("YYYY-MM-DD");
  let endDate = today.endOf("month").format("YYYY-MM-DD");
  let periodoLabel = today.format("MMMM/YYYY");
  
  // Se passou período específico, tentar interpretar
  if (params.periodo) {
    const periodoExtraido = extrairPeriodoDaMensagem(params.periodo);
    if (periodoExtraido) {
      startDate = periodoExtraido.mesInicio.format("YYYY-MM-DD");
      endDate = periodoExtraido.mesFim.format("YYYY-MM-DD");
      periodoLabel = periodoExtraido.mesInicio.format("MMMM/YYYY");
    }
  }
  
  const limit = params.limit || 20;
  const tipoFiltro = params.tipo || "todos";
  
  console.log(`📋 [LIST-TRANSACTIONS] Buscando lançamentos de ${periodoLabel}`);
  
  // Buscar transações
  const transactions = await dbService.getTransactions(user.id, {
    startDate,
    endDate,
    limit: limit + 10 // Buscar um pouco mais para filtrar
  });
  
  // Filtrar por tipo se especificado
  let filtradas = transactions;
  if (tipoFiltro === "receita") {
    filtradas = transactions.filter(t => 
      t.tipo_lancamento === "receita" || t.tipo_lancamento === "income"
    );
  } else if (tipoFiltro === "despesa") {
    filtradas = transactions.filter(t => 
      t.tipo_lancamento === "despesa" || t.tipo_lancamento === "expense"
    );
  }
  
  // Filtrar pelo período
  filtradas = filtradas.filter(t => {
    const data = t.data_pagamento || t.data_competencia;
    if (!data) return false;
    return dayjs(data).isBetween(startDate, endDate, 'day', '[]');
  });
  
  if (!filtradas || filtradas.length === 0) {
    return {
      success: true,
      data: { count: 0, items: [] },
      message: `📋 *Lançamentos - ${periodoLabel}*\n\nNão foram encontrados lançamentos neste período.`
    };
  }
  
  // Ordenar por data (mais recente primeiro)
  filtradas.sort((a, b) => {
    const dataA = dayjs(a.data_pagamento || a.data_competencia);
    const dataB = dayjs(b.data_pagamento || b.data_competencia);
    return dataB.diff(dataA);
  });
  
  // Limitar quantidade
  const exibir = filtradas.slice(0, limit);
  
  // Calcular totais
  let totalReceitas = 0;
  let totalDespesas = 0;
  
  filtradas.forEach(t => {
    const valor = Number(t.valor || 0);
    if (t.tipo_lancamento === "receita" || t.tipo_lancamento === "income") {
      totalReceitas += valor;
    } else {
      totalDespesas += valor;
    }
  });
  
  // Formatar lista
  const lista = exibir.map((t, i) => {
    const emoji = (t.tipo_lancamento === "receita" || t.tipo_lancamento === "income") ? "💚" : "🔴";
    const valor = formatCurrency(t.valor);
    const data = formatDate(t.data_pagamento || t.data_competencia);
    const desc = t.descricao || "Sem descrição";
    return `${i + 1}. ${emoji} ${desc}\n     ${valor} • ${data}`;
  }).join("\n\n");
  
  // Título baseado no filtro
  let titulo = "Lançamentos";
  if (tipoFiltro === "receita") titulo = "Receitas";
  if (tipoFiltro === "despesa") titulo = "Despesas";
  
  let resumo = "";
  if (tipoFiltro === "todos") {
    resumo = `\n\n📊 *Resumo:*\n💚 Receitas: ${formatCurrency(totalReceitas)}\n🔴 Despesas: ${formatCurrency(totalDespesas)}\n${totalReceitas - totalDespesas >= 0 ? "✅" : "❌"} Saldo: ${formatCurrency(totalReceitas - totalDespesas)}`;
  } else if (tipoFiltro === "receita") {
    resumo = `\n\n💚 *Total:* ${formatCurrency(totalReceitas)}`;
  } else {
    resumo = `\n\n🔴 *Total:* ${formatCurrency(totalDespesas)}`;
  }
  
  const message = `📋 *${titulo} - ${periodoLabel}*

${lista}
${filtradas.length > limit ? `\n... e mais ${filtradas.length - limit} lançamentos` : ""}${resumo}`;
  
  return {
    success: true,
    data: {
      count: filtradas.length,
      items: exibir,
      totalReceitas,
      totalDespesas
    },
    message
  };
}

function normalizarTexto(texto = "") {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")            // remove acentos
    .replace(/[^a-z0-9\s]/g, " ")               // remove pontuação
    .replace(/\s+/g, " ")
    .trim();
}
