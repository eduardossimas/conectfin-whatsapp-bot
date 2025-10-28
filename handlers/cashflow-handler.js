/**
 * Handler de Fluxo de Caixa
 * Gera relatório visual de fluxo de caixa mensal
 */

import { sendWhatsAppText, sendWhatsAppImage } from '../services/whatsapp-service.js';
import { getUserByPhone, getLancamentosParaFluxoCaixa } from '../services/database-service.js';
import { gerarGraficoFluxoCaixa } from '../services/chart-service-svg.js'; // NOVO: usando canvas puro
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { formatCurrency } from '../utils/helpers.js';

// Configurar dayjs
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.locale('pt-br');

/**
 * Handler principal de Fluxo de Caixa
 * 
 * @param {string} userId - ID do usuário
 * @param {string} from - Número do WhatsApp
 * @param {Object} extracted - Informações extraídas (pode conter período)
 */
export async function handleCashFlowReport(userId, from, extracted = {}) {
  try {
    console.log(`📊 [CASHFLOW] Gerando relatório de fluxo de caixa para usuário ${userId}`);
    
    // Pegar a mensagem original do usuário
    const mensagemUsuario = extracted?.original_message || extracted?.extracted_info || '';
    console.log(`📝 [CASHFLOW] Mensagem do usuário: "${mensagemUsuario}"`);
    
    // Determinar período (padrão: mês atual)
    const periodo = extrairPeriodo(mensagemUsuario);
    console.log(`📅 [CASHFLOW] Período: ${periodo.mesInicio.format('DD/MM/YYYY')} até ${periodo.mesFim.format('DD/MM/YYYY')}`);
    
    // Buscar lançamentos e bancos (a função retorna ambos)
    const { lancamentos, bancos } = await getLancamentosParaFluxoCaixa(
      userId,
      periodo.mesFim.format('YYYY-MM-DD')
    );
    
    console.log(`📊 [CASHFLOW] ${lancamentos.length} lançamentos encontrados`);
    console.log(`🏦 [CASHFLOW] ${bancos.length} bancos encontrados`);
    
    // Verificar se há dados
    if (lancamentos.length === 0) {
      const mesAno = periodo.mesInicio.format('MMMM/YYYY');
      await sendWhatsAppText(
        from, 
        `📊 *Fluxo de Caixa - ${mesAno}*\n\n` +
        `Não foram encontrados lançamentos neste período.`
      );
      return;
    }
    
    // Gerar gráfico (passando bancos para calcular saldo inicial)
    console.log('📈 [CASHFLOW] Gerando gráfico...');
    const graficoBuffer = await gerarGraficoFluxoCaixa(lancamentos, periodo, bancos, null);
    
    // Calcular totais para a mensagem de resumo (apenas do mês atual)
    const lancamentosMes = lancamentos.filter(l => {
      const data = l.data_pagamento 
        ? dayjs(l.data_pagamento).tz('America/Sao_Paulo')
        : dayjs(l.data_competencia).tz('America/Sao_Paulo');
      return data.isSame(periodo.mesInicio, 'month') && data.isSame(periodo.mesInicio, 'year');
    });
    
    const totais = calcularTotais(lancamentosMes);
    const mesAno = periodo.mesInicio.format('MMMM/YYYY');
    const mensagem = montarMensagemResumo(totais, mesAno, lancamentosMes.length);
    
    // Enviar gráfico com legenda
    await sendWhatsAppImage(from, graficoBuffer, mensagem);
    
    console.log(`✅ [CASHFLOW] Relatório enviado com sucesso`);
    
  } catch (error) {
    console.error(`❌ [CASHFLOW] Erro ao gerar relatório:`, error);
    throw error;
  }
}

/**
 * Extrai período da mensagem ou usa padrão (mês atual)
 * 
 * @param {string} mensagem - Mensagem do usuário
 * @returns {Object} - { mesInicio: dayjs, mesFim: dayjs }
 */
function extrairPeriodo(mensagem) {
  console.log(`🔍 [CASHFLOW] Extraindo período de: "${mensagem}"`);
  
  // Normalizar mensagem
  const texto = mensagem.toLowerCase().trim();
  
  // Data base (padrão: mês atual)
  let dataBase = dayjs().tz('America/Sao_Paulo');
  let encontrouPeriodo = false;
  
  // 1. Tentar encontrar nome do mês (com ou sem ano)
  const mesesNomes = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  
  for (let i = 0; i < mesesNomes.length; i++) {
    const nomeMes = mesesNomes[i];
    
    // Verificar se o nome do mês está na mensagem
    if (texto.includes(nomeMes)) {
      console.log(`📅 [CASHFLOW] Mês encontrado: ${nomeMes}`);
      
      // Tentar encontrar ano na mensagem (ex: "setembro de 2024", "setembro 2024")
      const regexAno = new RegExp(`${nomeMes}\\s*(?:de\\s*)?(\\d{4})`, 'i');
      const matchAno = texto.match(regexAno);
      
      if (matchAno && matchAno[1]) {
        const ano = parseInt(matchAno[1]);
        dataBase = dayjs().tz('America/Sao_Paulo').year(ano).month(i).date(1);
        console.log(`📅 [CASHFLOW] Ano encontrado: ${ano}`);
      } else {
        // Sem ano especificado: usar ano atual
        dataBase = dayjs().tz('America/Sao_Paulo').month(i).date(1);
        console.log(`📅 [CASHFLOW] Usando ano atual: ${dataBase.year()}`);
      }
      
      encontrouPeriodo = true;
      break;
    }
  }
  
  // 2. Se não encontrou nome do mês, tentar formato numérico (MM/YYYY ou MM-YYYY)
  if (!encontrouPeriodo) {
    const regexNumerico = /(\d{1,2})[\/-](\d{4})/;
    const matchNumerico = texto.match(regexNumerico);
    
    if (matchNumerico) {
      const mes = parseInt(matchNumerico[1]);
      const ano = parseInt(matchNumerico[2]);
      
      if (mes >= 1 && mes <= 12) {
        dataBase = dayjs().tz('America/Sao_Paulo').year(ano).month(mes - 1).date(1);
        console.log(`📅 [CASHFLOW] Formato numérico encontrado: ${mes}/${ano}`);
        encontrouPeriodo = true;
      }
    }
  }
  
  // 3. Se não encontrou nada, usar mês atual
  if (!encontrouPeriodo) {
    console.log(`📅 [CASHFLOW] Nenhum período específico encontrado, usando mês atual`);
  }
  
  // Primeiro e último dia do mês
  const mesInicio = dataBase.startOf('month');
  const mesFim = dataBase.endOf('month');
  
  const mesAnoFormatado = mesInicio.format('MMMM/YYYY');
  console.log(`✅ [CASHFLOW] Período final: ${mesAnoFormatado}`);
  
  return { mesInicio, mesFim };
}

/**
 * Calcula totais de receitas, despesas e saldo
 * 
 * @param {Array} lancamentos - Lista de lançamentos
 * @returns {Object} - { receitas, despesas, saldo }
 */
function calcularTotais(lancamentos) {
  let receitas = 0;
  let despesas = 0;
  
  lancamentos.forEach(lanc => {
    const valor = parseFloat(lanc.valor || 0);
    
    if (lanc.tipo_lancamento === 'receita') {
      receitas += valor;
    } else if (lanc.tipo_lancamento === 'despesa') {
      despesas += valor;
    }
  });
  
  const saldo = receitas - despesas;
  
  return { receitas, despesas, saldo };
}

/**
 * Monta mensagem de resumo do fluxo de caixa
 * 
 * @param {Object} totais - { receitas, despesas, saldo }
 * @param {string} mesAno - Mês/ano
 * @param {number} qtdLancamentos - Quantidade de lançamentos
 * @returns {string} - Mensagem formatada
 */
function montarMensagemResumo(totais, mesAno, qtdLancamentos) {
  const saldoEmoji = totais.saldo >= 0 ? '✅' : '❌';
  const saldoTexto = totais.saldo >= 0 ? 'Positivo' : 'Negativo';
  
  return `📊 *Fluxo de Caixa - ${mesAno}*

💰 *Resumo Financeiro:*
├─ 💚 Receitas: ${formatCurrency(totais.receitas)}
├─ 💸 Despesas: ${formatCurrency(totais.despesas)}
└─ ${saldoEmoji} Saldo: ${formatCurrency(Math.abs(totais.saldo))} (${saldoTexto})

📈 Total de lançamentos: ${qtdLancamentos}

_Gráfico gerado em ${dayjs().tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm')}_`;
}

export default {
  handleCashFlowReport
};
