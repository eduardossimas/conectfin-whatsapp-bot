/**
 * Serviço de Banco de Dados - Centraliza todas as operações do Supabase
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "../config/environment.js";

// Inicializar Supabase
const supabase = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE
);

// ========================= USUÁRIOS ========================

/**
 * Busca usuário por telefone (formato E.164)
 * 
 * @param {string} phone - Número no formato E.164 (ex: "+5532991473412")
 * @returns {Promise<Object|null>} - Dados do usuário ou null
 */
export async function getUserByPhone(phone) {
  console.log(`🔍 [DATABASE] Buscando usuário por telefone: ${phone}`);
  
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("phone_e164", phone)
    .maybeSingle();

  if (error) {
    console.error(`❌ [DATABASE] Erro ao buscar usuário:`, error);
    throw error;
  }
  
  if (data) {
    console.log(`✅ [DATABASE] Usuário encontrado: ID ${data.id}, Nome: ${data.nome || 'N/A'}`);
  } else {
    console.log(`❌ [DATABASE] Usuário não encontrado para: ${phone}`);
  }
  
  return data;
}

// ========================= BANCOS ========================

/**
 * Busca banco padrão do usuário (principal ou último criado)
 * 
 * @param {string} userId - ID do usuário
 * @returns {Promise<string|null>} - ID do banco ou null
 */
export async function getBancoIdPadrao(userId) {
  if (!userId) return null;

  console.log(`🏦 [DATABASE] Buscando banco padrão para usuário ${userId}`);

  // 1. Primeiro tenta buscar o banco principal (is_principal = true)
  const { data: bancoPrincipal, error: errorPrincipal } = await supabase
    .from("bancos")
    .select("id, nome_banco, is_principal")
    .eq("user_id", userId)
    .eq("is_principal", true)
    .limit(1);

  if (errorPrincipal) {
    console.error(`❌ [DATABASE] Erro ao buscar banco principal:`, errorPrincipal);
    throw errorPrincipal;
  }

  if (bancoPrincipal && bancoPrincipal.length > 0) {
    console.log(`✅ [DATABASE] Banco principal encontrado: ${bancoPrincipal[0].nome_banco} (ID: ${bancoPrincipal[0].id})`);
    return bancoPrincipal[0].id;
  }

  // 2. Se não houver banco principal, pega o último criado (fallback)
  console.log(`⚠️ [DATABASE] Nenhum banco principal definido, buscando último criado`);
  
  const { data: ultimoBanco, error: errorUltimo } = await supabase
    .from("bancos")
    .select("id, nome_banco")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (errorUltimo) {
    console.error(`❌ [DATABASE] Erro ao buscar último banco:`, errorUltimo);
    throw errorUltimo;
  }

  if (ultimoBanco && ultimoBanco.length > 0) {
    console.log(`✅ [DATABASE] Último banco encontrado: ${ultimoBanco[0].nome_banco} (ID: ${ultimoBanco[0].id})`);
    return ultimoBanco[0].id;
  }

  console.log(`❌ [DATABASE] Nenhum banco encontrado para o usuário`);
  return null;
}

/**
 * Busca informações de um banco específico
 * 
 * @param {string} bancoId - ID do banco
 * @returns {Promise<Object|null>} - Dados do banco
 */
export async function getBancoById(bancoId) {
  const { data, error } = await supabase
    .from("bancos")
    .select("*")
    .eq("id", bancoId)
    .single();

  if (error) throw error;
  return data;
}

// ========================= CATEGORIAS ========================

/**
 * Busca todas as categorias do usuário por tipo
 * 
 * @param {string} userId - ID do usuário
 * @param {string} tipoLancamento - "receita" ou "despesa"
 * @returns {Promise<Array>} - Lista de categorias
 */
export async function getAllUserCategorias(userId, tipoLancamento) {
  if (!userId) return [];

  console.log(`📂 [DATABASE] Buscando categorias para usuário ${userId}, tipo: ${tipoLancamento}`);

  const { data, error } = await supabase
    .from("categorias")
    .select("id, nome, tipo_lancamento")
    .eq("user_id", userId)
    .eq("tipo_lancamento", tipoLancamento || "despesa");

  if (error) {
    console.error(`❌ [DATABASE] Erro ao buscar categorias:`, error);
    throw error;
  }
  
  console.log(`✅ [DATABASE] Encontradas ${data?.length || 0} categorias`);
  return data || [];
}

/**
 * Busca categoria por nome (case insensitive)
 * 
 * @param {string} userId - ID do usuário
 * @param {string} nomeCategoria - Nome da categoria
 * @returns {Promise<Object|null>} - Dados da categoria
 */
export async function getCategoriaByName(userId, nomeCategoria) {
  const { data, error } = await supabase
    .from("categorias")
    .select("*")
    .eq("user_id", userId)
    .ilike("nome", nomeCategoria)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ========================= LANÇAMENTOS ========================

/**
 * Cria um novo lançamento financeiro
 * 
 * @param {Object} lancamento - Dados do lançamento
 * @returns {Promise<Object>} - Lançamento criado
 */
export async function createLancamento({
  user_id, // para validação (não salvo na tabela)
  tipo, // 'receita' | 'despesa'
  descricao,
  valor,
  data_competencia, // string 'YYYY-MM-DD' obrigatória
  data_pagamento = null, // string 'YYYY-MM-DD' opcional
  data_vencimento = null, // string 'YYYY-MM-DD' opcional
  banco_id, // -> id_banco (NOT NULL)
  categoria_id, // -> id_categoria (pode ser null)
  origem = "whatsapp", // não tem coluna correspondente; ignore ou crie coluna depois
}) {
  console.log(`💾 [DATABASE] Criando lançamento...`);
  
  // Validações
  if (!banco_id) {
    throw new Error(
      "❌ Nenhum banco encontrado para este usuário.\n\nPor favor:\n1. Acesse o sistema\n2. Cadastre pelo menos um banco\n3. Defina um como principal (opcional)\n\nApós isso, pode usar o WhatsApp normalmente! 🙂"
    );
  }
  if (!valor && valor !== 0) {
    throw new Error("valor é obrigatório neste schema.");
  }
  if (!descricao) {
    throw new Error("descricao é obrigatória.");
  }
  if (!data_competencia) {
    throw new Error("data_competencia é obrigatória.");
  }

  const rowToInsert = {
    descricao,
    valor,
    data_lancamento: data_competencia, // usa competência como lançamento por padrão
    tipo_lancamento: tipo,
    id_banco: banco_id,
    id_categoria: categoria_id || null,
    data_competencia,
    data_vencimento,
    data_pagamento,
  };

  console.log(`💾 [DATABASE] Dados do lançamento:`, JSON.stringify(rowToInsert, null, 2));

  const { data: row, error } = await supabase
    .from("lancamentos")
    .insert([rowToInsert])
    .select()
    .single();

  if (error) {
    console.error(`❌ [DATABASE] Erro ao criar lançamento:`, error);
    throw error;
  }
  
  console.log(`✅ [DATABASE] Lançamento criado com ID: ${row.id}`);
  return row;
}

/**
 * Busca lançamentos do usuário por período
 * 
 * @param {string} userId - ID do usuário
 * @param {string} dataInicio - Data início (YYYY-MM-DD)
 * @param {string} dataFim - Data fim (YYYY-MM-DD)
 * @returns {Promise<Array>} - Lista de lançamentos
 */
export async function getLancamentosByPeriodo(userId, dataInicio, dataFim) {
  // Primeiro busca todos os bancos do usuário
  const { data: bancos, error: bancosError } = await supabase
    .from("bancos")
    .select("id")
    .eq("user_id", userId);
    
  if (bancosError) throw bancosError;
  if (!bancos || bancos.length === 0) return [];
  
  const bancosIds = bancos.map(b => b.id);
  
  // Busca lançamentos dos bancos do usuário no período
  const { data, error } = await supabase
    .from("lancamentos")
    .select("*, categorias(nome), bancos(nome_banco)")
    .in("id_banco", bancosIds)
    .gte("data_competencia", dataInicio)
    .lte("data_competencia", dataFim)
    .order("data_competencia", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Busca lançamentos para cálculo de Fluxo de Caixa
 * Busca TODAS as transações até o fim do período (para calcular saldo carry-over)
 * 
 * @param {string} userId - ID do usuário
 * @param {string} dataFim - Data final do período (formato YYYY-MM-DD)
 * @returns {Promise<Array>} - Lista de lançamentos
 */
export async function getLancamentosParaFluxoCaixa(userId, dataFim) {
  console.log(`📊 [DATABASE] Buscando lançamentos para Fluxo de Caixa até ${dataFim}`);
  
  // Primeiro busca todos os bancos do usuário (incluindo saldo_inicial e data_inicio)
  const { data: bancos, error: bancosError } = await supabase
    .from("bancos")
    .select("id, saldo_inicial, data_inicio, nome_banco")
    .eq("user_id", userId);
    
  if (bancosError) {
    console.error(`❌ [DATABASE] Erro ao buscar bancos:`, bancosError);
    throw bancosError;
  }
  
  if (!bancos || bancos.length === 0) {
    console.log(`⚠️ [DATABASE] Nenhum banco encontrado para o usuário`);
    return { lancamentos: [], bancos: [] };
  }
  
  const bancosIds = bancos.map(b => b.id);
  console.log(`🏦 [DATABASE] ${bancos.length} bancos encontrados`);
  
  // Busca TODAS as transações até o fim do período (sem limite de data inicial)
  // Isso permite calcular o carry-over correto
  const { data: lancamentos, error } = await supabase
    .from("lancamentos")
    .select("*, categorias(nome), bancos(nome_banco, data_inicio, saldo_inicial)")
    .in("id_banco", bancosIds)
    .or(`data_pagamento.lte.${dataFim},and(data_pagamento.is.null,data_competencia.lte.${dataFim})`)
    .order("data_pagamento", { ascending: true, nullsFirst: false });

  if (error) {
    console.error(`❌ [DATABASE] Erro ao buscar lançamentos:`, error);
    throw error;
  }
  
  console.log(`✅ [DATABASE] ${lancamentos?.length || 0} lançamentos encontrados`);
  
  return {
    lancamentos: lancamentos || [],
    bancos: bancos
  };
}

/**
 * Busca contas a pagar (despesas não pagas)
 * 
 * @param {string} userId - ID do usuário
 * @returns {Promise<Array>} - Lista de contas a pagar
 */
export async function getContasAPagar(userId) {
  // Primeiro busca todos os bancos do usuário
  const { data: bancos, error: bancosError } = await supabase
    .from("bancos")
    .select("id")
    .eq("user_id", userId);
    
  if (bancosError) throw bancosError;
  if (!bancos || bancos.length === 0) return [];
  
  const bancosIds = bancos.map(b => b.id);
  
  // Busca despesas não pagas
  const { data, error } = await supabase
    .from("lancamentos")
    .select("*, categorias(nome), bancos(nome_banco)")
    .in("id_banco", bancosIds)
    .eq("tipo_lancamento", "despesa")
    .is("data_pagamento", null)
    .order("data_vencimento", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Busca contas a receber (receitas não recebidas)
 * 
 * @param {string} userId - ID do usuário
 * @returns {Promise<Array>} - Lista de contas a receber
 */
export async function getContasAReceber(userId) {
  // Primeiro busca todos os bancos do usuário
  const { data: bancos, error: bancosError } = await supabase
    .from("bancos")
    .select("id")
    .eq("user_id", userId);
    
  if (bancosError) throw bancosError;
  if (!bancos || bancos.length === 0) return [];
  
  const bancosIds = bancos.map(b => b.id);
  
  // Busca receitas não recebidas
  const { data, error } = await supabase
    .from("lancamentos")
    .select("*, categorias(nome), bancos(nome_banco)")
    .in("id_banco", bancosIds)
    .eq("tipo_lancamento", "receita")
    .is("data_pagamento", null)
    .order("data_vencimento", { ascending: true });

  if (error) throw error;
  return data || [];
}

// Exportar instância do Supabase para casos específicos
export { supabase };
