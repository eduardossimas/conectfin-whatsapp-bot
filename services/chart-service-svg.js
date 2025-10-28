/**
 * Serviço de Geração de Gráficos usando SVG puro
 * Implementação simples e confiável
 */

import dayjs from 'dayjs';
import 'dayjs/locale/pt-br.js';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { createCanvas } from 'canvas';

// Configurar dayjs
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('pt-br');

/**
 * Gera um gráfico de fluxo de caixa em formato PNG usando Canvas
 * @param {Array} lancamentos - Array de lançamentos do banco de dados
 * @param {Object} periodo - Objeto com mesInicio e mesFim (objetos dayjs)
 * @param {Array} bancos - Array de bancos do usuário
 * @param {string|null} bancoId - ID do banco selecionado ou null para todos
 * @returns {Promise<Buffer>} - Buffer da imagem PNG do gráfico
 */
export async function gerarGraficoFluxoCaixa(lancamentos, periodo, bancos = [], bancoId = null) {
  try {
    console.log('\n🎨 [CHART-SVG] Iniciando geração do gráfico de Fluxo de Caixa...');
    
    // Processar dados
    const dadosPorDia = processarDadosFluxoCaixa(lancamentos, periodo, bancos, bancoId);
    
    if (dadosPorDia.labels.length === 0) {
      throw new Error('Não há dados suficientes para gerar o gráfico neste período.');
    }
    
    // Dimensões do canvas
    const width = 800;
    const height = 600;
    const padding = { top: 80, right: 40, bottom: 80, left: 70 };
    
    // Criar canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Fundo branco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Área do gráfico
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // Encontrar valores máximos e mínimos
    const allValues = [...dadosPorDia.receitas, ...dadosPorDia.despesas, ...dadosPorDia.saldos];
    const maxValue = Math.max(...allValues, 0);
    const minValue = Math.min(...allValues, 0);
    const valueRange = maxValue - minValue;
    
    // Função para converter valores em coordenadas Y
    const getY = (value) => {
      return padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
    };
    
    // Função para converter índice em coordenada X
    const getX = (index) => {
      const barWidth = chartWidth / dadosPorDia.labels.length;
      return padding.left + (index * barWidth) + (barWidth / 2);
    };
    
    // Desenhar grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }
    
    // Desenhar barras
    const barWidth = chartWidth / dadosPorDia.labels.length * 0.35;
    
    dadosPorDia.labels.forEach((label, i) => {
      const x = getX(i);
      const receita = dadosPorDia.receitas[i];
      const despesa = dadosPorDia.despesas[i];
      
      // Barra de receita (verde)
      if (receita > 0) {
        const h = ((receita / valueRange) * chartHeight);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.8)';
        ctx.fillRect(x - barWidth - 2, getY(receita), barWidth, h);
      }
      
      // Barra de despesa (vermelha)
      if (despesa > 0) {
        const h = ((despesa / valueRange) * chartHeight);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
        ctx.fillRect(x + 2, getY(despesa), barWidth, h);
      }
    });
    
    // Desenhar linha do saldo (azul)
    ctx.strokeStyle = 'rgb(59, 130, 246)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    dadosPorDia.saldos.forEach((saldo, i) => {
      const x = getX(i);
      const y = getY(saldo);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Desenhar pontos do saldo
    ctx.fillStyle = 'rgb(59, 130, 246)';
    dadosPorDia.saldos.forEach((saldo, i) => {
      const x = getX(i);
      const y = getY(saldo);
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Borda branca
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    
    // Labels do eixo X (dias)
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    
    dadosPorDia.labels.forEach((label, i) => {
      const x = getX(i);
      const dia = label.split('/')[0];
      ctx.fillText(dia, x, height - padding.bottom + 20);
    });
    
    // Labels do eixo Y (valores)
    ctx.textAlign = 'right';
    ctx.font = '11px Arial';
    
    for (let i = 0; i <= 5; i++) {
      const value = minValue + (valueRange / 5) * (5 - i);
      const y = padding.top + (chartHeight / 5) * i;
      const formatted = `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      ctx.fillText(formatted, padding.left - 10, y + 4);
    }
    
    // Título
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Fluxo Diário do Mês', width / 2, 30);
    
    // Subtítulo
    ctx.font = '12px Arial';
    ctx.fillStyle = '#6b7280';
    const mesAno = periodo.mesInicio.format('MMMM/YYYY');
    ctx.fillText(`Gastos por dia e saldo acumulado — ${mesAno}`, width / 2, 50);
    
    // Legenda
    const legendY = height - 30;
    const legendSpacing = 150;
    const legendStartX = width / 2 - legendSpacing * 1.5;
    
    // Receitas
    ctx.fillStyle = 'rgba(34, 197, 94, 0.8)';
    ctx.fillRect(legendStartX, legendY - 8, 15, 15);
    ctx.fillStyle = '#374151';
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Receitas (Entradas)', legendStartX + 20, legendY + 3);
    
    // Despesas
    ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
    ctx.fillRect(legendStartX + legendSpacing, legendY - 8, 15, 15);
    ctx.fillText('Gastos (Saídas)', legendStartX + legendSpacing + 20, legendY + 3);
    
    // Saldo
    ctx.strokeStyle = 'rgb(59, 130, 246)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(legendStartX + legendSpacing * 2, legendY);
    ctx.lineTo(legendStartX + legendSpacing * 2 + 15, legendY);
    ctx.stroke();
    
    ctx.fillStyle = 'rgb(59, 130, 246)';
    ctx.beginPath();
    ctx.arc(legendStartX + legendSpacing * 2 + 7, legendY, 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#374151';
    ctx.fillText('Saldo Acumulado', legendStartX + legendSpacing * 2 + 20, legendY + 3);
    
    // Converter para buffer
    const buffer = canvas.toBuffer('image/png');
    console.log(`✅ [CHART-SVG] Gráfico gerado com sucesso: ${buffer.length} bytes`);
    
    return buffer;
    
  } catch (error) {
    console.error('❌ [CHART-SVG] Erro ao gerar gráfico:', error);
    throw error;
  }
}

/**
 * Processa os dados de lançamentos para gerar dados diários do fluxo de caixa
 */
function processarDadosFluxoCaixa(lancamentos, periodo, bancos = [], bancoId = null) {
  console.log(`\n📊 [CHART] Processando ${lancamentos.length} lançamentos para o período`);
  console.log(`🏦 [CHART] Banco selecionado: ${bancoId || 'TODOS'}`);
  
  const { mesInicio, mesFim } = periodo;
  const diasNoMes = mesFim.date();
  
  // Calcular saldo inicial
  let saldoInicial = 0;
  
  if (!bancoId || bancoId === 'all') {
    saldoInicial = bancos.reduce((acc, banco) => acc + (parseFloat(banco.saldo_inicial) || 0), 0);
  } else {
    const bancoSelecionado = bancos.find(b => b.id === bancoId);
    saldoInicial = parseFloat(bancoSelecionado?.saldo_inicial) || 0;
  }
  
  // Calcular transações anteriores
  const transacoesAnteriores = lancamentos.filter(t => {
    if (!t.data_pagamento) return false;
    
    const dataPagamento = dayjs(t.data_pagamento).tz('America/Sao_Paulo');
    const antesDoMes = dataPagamento.isBefore(mesInicio, 'day');
    const mesmoBank = !bancoId || bancoId === 'all' || t.id_banco === bancoId;
    const ehMovimentacao = t.tipo_lancamento === 'receita' || t.tipo_lancamento === 'despesa';
    
    return antesDoMes && mesmoBank && ehMovimentacao;
  });
  
  const saldoTransacoesAnteriores = transacoesAnteriores.reduce((acc, t) => {
    const valor = parseFloat(t.valor) || 0;
    return acc + (t.tipo_lancamento === 'receita' ? valor : -valor);
  }, 0);
  
  const saldoCarryOver = saldoInicial + saldoTransacoesAnteriores;
  console.log(`📦 [CHART] Saldo carry-over: R$ ${saldoCarryOver.toFixed(2)}`);
  
  // Processar cada dia
  const labels = [];
  const receitas = [];
  const despesas = [];
  const saldos = [];
  
  let saldoAcumulado = saldoCarryOver;
  
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const diaAtual = mesInicio.date(dia);
    const diaFormatado = diaAtual.format('DD/MM');
    labels.push(diaFormatado);
    
    let receitaDia = 0;
    let despesaDia = 0;
    
    lancamentos.forEach(lancamento => {
      let dataLancamento = null;
      
      if (lancamento.data_pagamento) {
        dataLancamento = dayjs(lancamento.data_pagamento).tz('America/Sao_Paulo');
      } else if (lancamento.data_competencia) {
        dataLancamento = dayjs(lancamento.data_competencia).tz('America/Sao_Paulo');
      }
      
      if (!dataLancamento) return;
      
      if (dataLancamento.date() === dia && 
          dataLancamento.month() === diaAtual.month() && 
          dataLancamento.year() === diaAtual.year()) {
        
        const valor = parseFloat(lancamento.valor) || 0;
        const tipo = lancamento.tipo_lancamento;
        
        if (tipo === 'receita') {
          receitaDia += valor;
        } else if (tipo === 'despesa') {
          despesaDia += valor;
        }
      }
    });
    
    receitas.push(receitaDia);
    despesas.push(despesaDia);
    
    saldoAcumulado += (receitaDia - despesaDia);
    saldos.push(saldoAcumulado);
  }
  
  console.log(`✅ [CHART] Processados ${labels.length} dias`);
  
  return { labels, receitas, despesas, saldos };
}

export default { gerarGraficoFluxoCaixa };
