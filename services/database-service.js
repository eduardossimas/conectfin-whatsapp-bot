import { apiClient } from './api-client.js';

/**
 * DatabaseService - Serviço para interagir com a API ConectFin
 * 
 * Fluxo:
 * 1. Recebe mensagem de um número WhatsApp
 * 2. Busca qual user_id possui esse número cadastrado
 * 3. Executa operações em nome desse usuário
 */

// Cache simples para evitar buscar o mesmo usuário várias vezes
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

class DatabaseService {
  /**
   * Busca o user_id a partir do número de WhatsApp
   * @param {string} phoneNumber - Número no formato E.164 (+5532991473412)
   * @returns {Promise<string|null>} user_id ou null se não encontrado
   */
  async getUserIdByPhone(phoneNumber) {
    try {
      // Verifica cache primeiro
      const cached = userCache.get(phoneNumber);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[DB] 📦 User cache hit: ${phoneNumber} → ${cached.userId}`);
        // Retornar objeto completo do usuário, não apenas ID
        return cached.userData;
      }

      console.log(`[DB] 🔍 Buscando usuário pelo telefone: ${phoneNumber}`);
      
      const response = await apiClient.getUserByPhone(phoneNumber);
      
      console.log(`[DB] 📊 Resposta da API:`, JSON.stringify(response, null, 2));
      
      // A API retorna { success: true, data: { id, nome, ... } }
      const userData = response?.data || response;
      
      if (!userData || !userData.id) {
        console.log(`[DB] ❌ Usuário não encontrado para: ${phoneNumber}`);
        console.log(`[DB] ℹ️ Dados retornados:`, userData);
        return null;
      }

      const userId = userData.id;
      
      // Atualiza cache com dados completos
      userCache.set(phoneNumber, {
        userId,
        userData,
        timestamp: Date.now(),
        userName: userData.nome || userData.name
      });

      console.log(`[DB] ✅ Usuário encontrado: ${userData.nome || userData.name} (${userId})`);
      return userData;

    } catch (error) {
      console.error('[DB] ❌ Erro ao buscar usuário por telefone:', error.message);
      console.error('[DB] 📍 Stack trace:', error.stack);
      return null;
    }
  }

  /**
   * Busca informações do usuário
   */
  async getUserProfile(userId) {
    try {
      console.log(`[DB] 👤 Buscando perfil do usuário: ${userId}`);
      return await apiClient.get(`/users/${userId}`);
    } catch (error) {
      console.error('[DB] ❌ Erro ao buscar perfil:', error.message);
      throw error;
    }
  }

  /**
   * Busca todas as contas bancárias do usuário
   */
  async getUserAccounts(userId) {
    try {
      console.log(`[DB] 🏦 Buscando contas do usuário: ${userId}`);
      const accounts = await apiClient.getAccounts(userId);
      return accounts || [];
    } catch (error) {
      console.error('[DB] ❌ Erro ao buscar contas:', error.message);
      return [];
    }
  }

  /**
   * Busca uma conta específica
   */
  async getAccount(accountId, userId) {
    try {
      console.log(`[DB] 🏦 Buscando conta: ${accountId}`);
      return await apiClient.get(`/banks/${accountId}`, { user_id: userId });
    } catch (error) {
      console.error('[DB] ❌ Erro ao buscar conta:', error.message);
      throw error;
    }
  }

  /**
   * Busca todas as categorias disponíveis
   */
  async getCategories(userId, type = null) {
    try {
      console.log(`[DB] 📂 Buscando categorias${type ? ` (${type})` : ''}`);
      const categories = await apiClient.getCategories(userId, type);
      return categories || [];
    } catch (error) {
      console.error('[DB] ❌ Erro ao buscar categorias:', error.message);
      return [];
    }
  }

  /**
   * Cria uma nova transação
   */
  async createTransaction(userId, transactionData) {
    try {
      console.log('[DB] 💰 Criando transação:', {
        userId,
        tipo: transactionData.tipo_lancamento,
        valor: transactionData.valor_lancamento,
        descricao: transactionData.descricao
      });

      const payload = {
        user_id: userId,
        id_banco: transactionData.id_banco,
        id_categoria: transactionData.id_categoria,
        descricao: transactionData.descricao,
        valor: parseFloat(transactionData.valor_lancamento),
        tipo_lancamento: transactionData.tipo_lancamento,
        data_competencia: transactionData.data_competencia,
        data_lancamento: transactionData.data_competencia, // Usa competência como lançamento
        data_vencimento: transactionData.data_vencimento || null,
        data_pagamento: transactionData.data_pagamento || null
      };

      console.log('[DB] 📦 Payload completo:', JSON.stringify(payload, null, 2));

      const result = await apiClient.post('/transactions', payload);
      console.log('[DB] ✅ Transação criada:', result.id);
      return result;

    } catch (error) {
      console.error('[DB] ❌ Erro ao criar transação:', error.message);
      throw error;
    }
  }

  /**
   * Busca transações com filtros
   */
  async getTransactions(userId, filters = {}) {
    try {
      console.log('[DB] 📊 Buscando transações:', filters);
      
      const params = {
        user_id: userId,
        page: filters.page || 1,
        limit: filters.limit || 50
      };

      if (filters.type) params.type = filters.type;
      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.account_id) params.account_id = filters.account_id;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const transactions = await apiClient.get('/transactions', params);
      return transactions || [];

    } catch (error) {
      console.error('[DB] ❌ Erro ao buscar transações:', error.message);
      return [];
    }
  }

  /**
   * Busca resumo financeiro
   */
  async getFinancialSummary(userId, startDate, endDate) {
    try {
      console.log('[DB] 📈 Buscando resumo financeiro');
      
      return await apiClient.get('/reports/summary', {
        user_id: userId,
        startDate,
        endDate
      });

    } catch (error) {
      console.error('[DB] ❌ Erro ao buscar resumo:', error.message);
      throw error;
    }
  }

  /**
   * Busca transações agrupadas por categoria
   */
  async getTransactionsByCategory(userId, filters = {}) {
    try {
      console.log('[DB] 📊 Buscando transações por categoria');
      
      const params = {
        user_id: userId,
        type: filters.type
      };

      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      return await apiClient.get('/reports/by-category', params);

    } catch (error) {
      console.error('[DB] ❌ Erro ao buscar por categoria:', error.message);
      return [];
    }
  }

  /**
   * Atualiza uma transação
   */
  async updateTransaction(transactionId, userId, updates) {
    try {
      console.log(`[DB] ✏️ Atualizando transação: ${transactionId}`);
      
      return await apiClient.put(`/transactions/${transactionId}`, {
        user_id: userId,
        ...updates
      });

    } catch (error) {
      console.error('[DB] ❌ Erro ao atualizar transação:', error.message);
      throw error;
    }
  }

  /**
   * Deleta uma transação
   */
  async deleteTransaction(transactionId, userId) {
    try {
      console.log(`[DB] 🗑️ Deletando transação: ${transactionId}`);
      
      return await apiClient.delete(`/transactions/${transactionId}`, {
        user_id: userId
      });

    } catch (error) {
      console.error('[DB] ❌ Erro ao deletar transação:', error.message);
      throw error;
    }
  }

  /**
   * Limpa o cache de usuários
   */
  clearCache() {
    userCache.clear();
    console.log('[DB] 🧹 Cache limpo');
  }
}

const dbService = new DatabaseService();
export default dbService;

// ============ EXPORTS COMPATÍVEIS COM API ANTIGA ============
// Mantém compatibilidade com código existente

export async function getUserByPhone(phone) {
  const userData = await dbService.getUserIdByPhone(phone);
  return userData; // Retorna objeto completo agora
}

export async function getBancoIdPadrao(userId) {
  const accounts = await dbService.getUserAccounts(userId);
  if (!accounts || accounts.length === 0) return null;
  
  const principal = accounts.find(acc => acc.is_principal);
  if (principal) return principal.id;
  
  return accounts[0]?.id || null;
}

export async function getAllUserCategorias(userId, tipoLancamento) {
  const type = tipoLancamento === "receita" ? "income" : 
               tipoLancamento === "despesa" ? "expense" : 
               tipoLancamento;
  return dbService.getCategories(userId, type);
}

export async function createLancamento(lancamentoData) {
  const { user_id, tipo, descricao, valor, data_competencia, data_pagamento, data_vencimento, banco_id, categoria_id } = lancamentoData;
  
  return dbService.createTransaction(user_id, {
    tipo_lancamento: tipo,
    descricao,
    valor_lancamento: valor,
    data_competencia,
    data_pagamento,
    data_vencimento,
    id_banco: banco_id,
    id_categoria: categoria_id
  });
}

export async function getContasAPagar(userId) {
  return dbService.getTransactions(userId, { 
    type: 'despesa',
    status: 'pending'
  });
}

export async function getContasAReceber(userId) {
  return dbService.getTransactions(userId, { 
    type: 'receita',
    status: 'pending'
  });
}

export async function getLancamentosByPeriodo(userId, dataInicio, dataFim) {
  return dbService.getTransactions(userId, {
    startDate: dataInicio,
    endDate: dataFim
  });
}

export async function getLancamentosParaFluxoCaixa(userId, dataFim) {
  const accounts = await dbService.getUserAccounts(userId);
  const transactions = await dbService.getTransactions(userId, {
    endDate: dataFim
  });
  
  return {
    lancamentos: transactions,
    bancos: accounts
  };
}

// Removido export do supabase pois não existe mais