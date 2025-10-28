/**
 * Serviço de Geração de Gráficos
 * Usa Chart.js para gerar gráficos em imagem
 */

import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br.js';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

// Configurar dayjs
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('pt-br');

// Configurar ChartJS para gerar gráficos 800x600px
const chartJSNodeCanvas = new ChartJSNodeCanvas({ 
  width: 800, 
  height: 600,
  backgroundColour: 'white'
});

/**
 * Gera um gráfico de fluxo de caixa em formato PNG
 * @param {Array} lancamentos - Array de lançamentos do banco de dados
 * @param {Object} periodo - Objeto com mesInicio e mesFim (objetos dayjs)
 * @param {Array} bancos - Array de bancos do usuário
 * @param {string|null} bancoId - ID do banco selecionado ou null para todos
 * @returns {Promise<Buffer>} - Buffer da imagem PNG do gráfico
 */
export async function gerarGraficoFluxoCaixa(lancamentos, periodo, bancos = [], bancoId = null) {
  try {
    console.log('\n🎨 [CHART] Iniciando geração do gráfico de Fluxo de Caixa...');
    
    // Criar instância do ChartJS
    const chartCanvas = new ChartJSNodeCanvas({ 
      width: 800, 
      height: 600,
      backgroundColour: 'white'
    });
    
    // Processar dados (incluindo saldo inicial e carry-over)
    const dadosPorDia = processarDadosFluxoCaixa(lancamentos, periodo, bancos, bancoId);
    
    // Verificar se há dados
    if (dadosPorDia.labels.length === 0) {
      console.log('⚠️ [CHART] Nenhum dado para gerar gráfico');
      throw new Error('Não há dados suficientes para gerar o gráfico neste período.');
    }
    
    // Formatar mês/ano para o título
    const mesAno = periodo.mesInicio.format('MMMM/YYYY');
    
    // Configuração do gráfico
    const configuration = {
      type: 'line', // Tipo principal: linha (depois sobrescrevemos as barras)
      data: {
        labels: dadosPorDia.labels,
        datasets: [
          {
            label: 'Receitas (Entradas)',
            data: dadosPorDia.receitas,
            type: 'bar', // Sobrescreve para barra
            backgroundColor: 'rgba(34, 197, 94, 0.8)', // Verde
            borderColor: 'rgb(34, 197, 94)',
            borderWidth: 1,
            order: 2
          },
          {
            label: 'Gastos (Saídas)',
            data: dadosPorDia.despesas,
            type: 'bar', // Sobrescreve para barra
            backgroundColor: 'rgba(239, 68, 68, 0.8)', // Vermelho
            borderColor: 'rgb(239, 68, 68)',
            borderWidth: 1,
            order: 2
          },
          {
            label: 'Saldo Acumulado',
            data: dadosPorDia.saldos,
            borderColor: 'rgb(59, 130, 246)', // Azul
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 4, // Linha mais grossa
            fill: false,
            tension: 0.3, // Curva mais suave
            pointRadius: 5,
            pointHoverRadius: 8,
            pointBackgroundColor: 'rgb(59, 130, 246)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointHoverBorderWidth: 3,
            order: 1,
            spanGaps: true // Conecta pontos mesmo se houver gaps
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: [`Fluxo Diário do Mês`, `Gastos por dia e saldo acumulado — ${mesAno}`],
            font: {
              size: 16,
              weight: 'bold'
            },
            padding: {
              top: 10,
              bottom: 20
            }
          },
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              font: {
                size: 12
              },
              usePointStyle: true,
              padding: 15,
              boxWidth: 12,
              boxHeight: 12
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleFont: {
              size: 13
            },
            bodyFont: {
              size: 12
            },
            padding: 12,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                const value = context.parsed.y;
                label += 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return label;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false, // IMPORTANTE: permitir valores negativos
            position: 'left',
            ticks: {
              callback: function(value) {
                return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
              },
              font: {
                size: 10
              }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
              drawBorder: false
            }
          },
          x: {
            ticks: {
              font: {
                size: 9
              },
              maxRotation: 0,
              minRotation: 0
            },
            grid: {
              display: false
            }
          }
        },
        interaction: {
          mode: 'index',
          intersect: false
        }
      }
    };
    
    // Gerar imagem
    const image = await chartCanvas.renderToBuffer(configuration);
    console.log(`✅ [CHART] Gráfico gerado com sucesso: ${image.length} bytes`);
    
    return image;
    
  } catch (error) {
    console.error('❌ [CHART] Erro ao gerar gráfico:', error);
    throw error;
  }
}

/**
 * Processa os dados de lançamentos para gerar dados diários do fluxo de caixa
 * Segue a mesma lógica do sistema web ConectFin
 * @param {Array} lancamentos - Array de lançamentos do banco de dados
 * @param {Object} periodo - Objeto com mesInicio e mesFim (objetos dayjs)
 * @param {Array} bancos - Array de bancos (para calcular saldo inicial)
 * @param {string|null} bancoId - ID do banco selecionado ou null para todos
 * @returns {Object} - Objeto com labels, receitas, despesas e saldos
 */
function processarDadosFluxoCaixa(lancamentos, periodo, bancos = [], bancoId = null) {
  console.log(`\n📊 [CHART] Processando ${lancamentos.length} lançamentos para o período`);
  console.log(`🏦 [CHART] Banco selecionado: ${bancoId || 'TODOS'}`);
  
  const { mesInicio, mesFim } = periodo;
  const diasNoMes = mesFim.date();
  
  // PASSO 1: Calcular saldo inicial (carry-over)
  // Inclui: saldo_inicial dos bancos + movimentações PAGAS anteriores ao mês
  let saldoInicial = 0;
  
  if (!bancoId || bancoId === 'all') {
    // Todas as contas: somar saldo_inicial de todos os bancos
    saldoInicial = bancos.reduce((acc, banco) => acc + (parseFloat(banco.saldo_inicial) || 0), 0);
    console.log(`💰 [CHART] Saldo inicial (todos os bancos): R$ ${saldoInicial.toFixed(2)}`);
  } else {
    // Conta específica: usar apenas o saldo_inicial dela
    const bancoSelecionado = bancos.find(b => b.id === bancoId);
    saldoInicial = parseFloat(bancoSelecionado?.saldo_inicial) || 0;
    console.log(`� [CHART] Saldo inicial (${bancoSelecionado?.nome_banco}): R$ ${saldoInicial.toFixed(2)}`);
  }
  
  // Calcular movimentações PAGAS antes do início do mês
  const transacoesAnteriores = lancamentos.filter(t => {
    // Apenas transações PAGAS (com data_pagamento)
    if (!t.data_pagamento) return false;
    
    const dataPagamento = dayjs(t.data_pagamento).tz('America/Sao_Paulo');
    const antesDoMes = dataPagamento.isBefore(mesInicio, 'day');
    const mesmoBank = !bancoId || bancoId === 'all' || t.id_banco === bancoId;
    const ehMovimentacao = t.tipo_lancamento === 'receita' || t.tipo_lancamento === 'despesa';
    
    // Verificar data_inicio do banco (se aplicável)
    if (bancoId && bancoId !== 'all') {
      const banco = bancos.find(b => b.id === t.id_banco);
      if (banco?.data_inicio) {
        const dataInicioBanco = dayjs(banco.data_inicio).tz('America/Sao_Paulo');
        if (dataPagamento.isBefore(dataInicioBanco, 'day')) {
          return false; // Ignorar transações antes da data_inicio do banco
        }
      }
    }
    
    return antesDoMes && mesmoBank && ehMovimentacao;
  });
  
  console.log(`📅 [CHART] ${transacoesAnteriores.length} transações anteriores ao mês encontradas`);
  
  const saldoTransacoesAnteriores = transacoesAnteriores.reduce((acc, t) => {
    const valor = parseFloat(t.valor) || 0;
    return acc + (t.tipo_lancamento === 'receita' ? valor : -valor);
  }, 0);
  
  console.log(`💵 [CHART] Saldo de transações anteriores: R$ ${saldoTransacoesAnteriores.toFixed(2)}`);
  
  const saldoCarryOver = saldoInicial + saldoTransacoesAnteriores;
  console.log(`📦 [CHART] Saldo carry-over (inicial + movimentações anteriores): R$ ${saldoCarryOver.toFixed(2)}`);
  
  // PASSO 2: Processar cada dia do mês
  const labels = [];
  const receitas = [];
  const despesas = [];
  const saldos = [];
  
  let saldoAcumulado = saldoCarryOver; // Começar com o saldo carry-over
  
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const diaAtual = mesInicio.date(dia);
    const diaFormatado = diaAtual.format('DD/MM');
    labels.push(diaFormatado);
    
    let receitaDia = 0;
    let despesaDia = 0;
    
    // Filtrar lançamentos deste dia
    // Prioridade de data: data_pagamento (se pago) > data_competencia (se não pago)
    lancamentos.forEach(lancamento => {
      // Determinar qual data usar
      let dataLancamento = null;
      let dataPriorizada = null;
      
      if (lancamento.data_pagamento) {
        // Se tem data_pagamento, usar ela (transação paga)
        dataLancamento = dayjs(lancamento.data_pagamento).tz('America/Sao_Paulo');
        dataPriorizada = 'data_pagamento';
      } else if (lancamento.data_competencia) {
        // Se não tem pagamento, usar competência (transação não paga)
        dataLancamento = dayjs(lancamento.data_competencia).tz('America/Sao_Paulo');
        dataPriorizada = 'data_competencia';
      }
      
      if (!dataLancamento) {
        console.warn(`⚠️ [CHART] Lançamento sem data válida:`, lancamento.id);
        return;
      }
      
      // Verificar se é do dia atual e do mês correto
      if (dataLancamento.date() === dia && 
          dataLancamento.month() === diaAtual.month() && 
          dataLancamento.year() === diaAtual.year()) {
        
        // Verificar data_inicio do banco
        if (bancoId && bancoId !== 'all') {
          const banco = bancos.find(b => b.id === lancamento.id_banco);
          if (banco?.data_inicio) {
            const dataInicioBanco = dayjs(banco.data_inicio).tz('America/Sao_Paulo');
            if (dataLancamento.isBefore(dataInicioBanco, 'day')) {
              return; // Ignorar transações antes da data_inicio do banco
            }
          }
        }
        
        const valor = parseFloat(lancamento.valor) || 0;
        const tipo = lancamento.tipo_lancamento;
        const pago = lancamento.data_pagamento ? 'SIM' : 'NÃO';
        
        console.log(`📅 [CHART] Lançamento: ${tipo} R$ ${valor.toFixed(2)} em ${dataLancamento.format('DD/MM/YYYY')} (${dataPriorizada}, pago: ${pago})`);
        
        if (tipo === 'receita') {
          receitaDia += valor;
        } else if (tipo === 'despesa') {
          despesaDia += valor;
        }
      }
    });
    
    receitas.push(receitaDia);
    despesas.push(despesaDia);
    
    // Calcular saldo acumulado
    saldoAcumulado += (receitaDia - despesaDia);
    saldos.push(saldoAcumulado);
  }
  
  console.log(`✅ [CHART] Processados ${labels.length} dias com dados`);
  console.log(`💵 [CHART] Saldo final do período: R$ ${saldoAcumulado.toFixed(2)}`);
  console.log(`📊 [CHART] Dados do gráfico:`);
  console.log(`   - Labels (${labels.length}): ${labels.slice(0, 5).join(', ')}...`);
  console.log(`   - Receitas (${receitas.length}): ${receitas.slice(0, 5).join(', ')}...`);
  console.log(`   - Despesas (${despesas.length}): ${despesas.slice(0, 5).join(', ')}...`);
  console.log(`   - Saldos (${saldos.length}): [${saldos[0]?.toFixed(2)}, ${saldos[Math.floor(saldos.length/2)]?.toFixed(2)}, ${saldos[saldos.length-1]?.toFixed(2)}]`);
  
  return {
    labels,
    receitas,
    despesas,
    saldos
  };
}

export default {
  gerarGraficoFluxoCaixa
};
