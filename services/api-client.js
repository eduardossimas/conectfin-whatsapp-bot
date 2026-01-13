/**
 * ConectFin API Client
 * Cliente HTTP para comunicação com a API REST do ConectFin
 */

import axios from "axios";
import { config } from "../config/environment.js";

/**
 * Classe para gerenciar comunicação com a API ConectFin
 */
class ConectFinAPI {
  constructor() {
    this.baseURL = config.API_BASE_URL;
    this.token = null;
    this.tokenExpiry = null;
    
    // Criar instância do axios
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Interceptor para adicionar token automaticamente
    this.client.interceptors.request.use(
      async (config) => {
        // Verificar se o token expirou e renovar se necessário
        await this.ensureValidToken();
        
        // Adicionar token ao header
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Interceptor para tratar erros de autenticação
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Se receber 401 e não for a primeira tentativa, tentar renovar token
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          console.log("🔄 [API] Token expirado, tentando renovar...");
          await this.login(true); // Forçar novo login
          
          // Tentar a requisição novamente com novo token
          originalRequest.headers.Authorization = `Bearer ${this.token}`;
          return this.client(originalRequest);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Faz login na API e obtém token JWT
   * @param {boolean} forceLogin - Força novo login mesmo se token ainda válido
   */
  async login(forceLogin = false) {
    // Se já tem token válido e não está forçando, retornar
    if (!forceLogin && this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    if (!config.API_EMAIL || !config.API_PASSWORD) {
      throw new Error(
        "❌ Credenciais da API não configuradas. Configure API_EMAIL e API_PASSWORD no .env"
      );
    }

    try {
      console.log("🔐 [API] Fazendo login na API ConectFin...");
      
      const response = await axios.post(`${this.baseURL}/auth/login`, {
        email: config.API_EMAIL,
        password: config.API_PASSWORD,
      });

      this.token = response.data.token;
      
      // Definir expiração do token (geralmente 24h, vamos usar 23h para segurança)
      this.tokenExpiry = Date.now() + (23 * 60 * 60 * 1000);
      
      console.log("✅ [API] Login realizado com sucesso");
      return this.token;
    } catch (error) {
      console.error("❌ [API] Erro ao fazer login:", error.response?.data || error.message);
      throw new Error(`Falha ao autenticar na API: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Garante que há um token válido antes de fazer requisições
   */
  async ensureValidToken() {
    if (!this.token || !this.tokenExpiry || Date.now() >= this.tokenExpiry) {
      await this.login();
    }
  }

  /**
   * Métodos HTTP genéricos
   */
  async get(url, params = {}) {
    try {
      const response = await this.client.get(url, { params });
      // Se a API retorna { success: true, data: {...} }, extrair o data
      return response.data?.data || response.data;
    } catch (error) {
      this.handleError(error, 'GET', url);
    }
  }

  async post(url, data = {}) {
    try {
      const response = await this.client.post(url, data);
      // Se a API retorna { success: true, data: {...} }, extrair o data
      return response.data?.data || response.data;
    } catch (error) {
      this.handleError(error, 'POST', url);
    }
  }

  async put(url, data = {}) {
    try {
      const response = await this.client.put(url, data);
      // Se a API retorna { success: true, data: {...} }, extrair o data
      return response.data?.data || response.data;
    } catch (error) {
      this.handleError(error, 'PUT', url);
    }
  }

  async delete(url) {
    try {
      const response = await this.client.delete(url);
      // Se a API retorna { success: true, data: {...} }, extrair o data
      return response.data?.data || response.data;
    } catch (error) {
      this.handleError(error, 'DELETE', url);
    }
  }

  /**
   * Tratamento centralizado de erros
   */
  handleError(error, method, url) {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;
    
    console.error(`❌ [API] Erro ${method} ${url}:`, {
      status,
      message,
      data: error.response?.data,
    });

    // Lançar erro com mensagem amigável
    if (status === 400) {
      throw new Error(`Dados inválidos: ${message}`);
    } else if (status === 401) {
      throw new Error(`Não autorizado: ${message}`);
    } else if (status === 403) {
      throw new Error(`Acesso negado: ${message}`);
    } else if (status === 404) {
      throw new Error(`Recurso não encontrado: ${message}`);
    } else if (status >= 500) {
      throw new Error(`Erro no servidor: ${message}`);
    } else {
      throw new Error(`Erro na API: ${message}`);
    }
  }

  // ========================= ENDPOINTS ESPECÍFICOS =========================

  /**
   * USUÁRIOS
   */
  async getUserProfile() {
    return this.get("/users/me");
  }

  async updateUserProfile(data) {
    return this.put("/users/profile", data);
  }

  async getUserByPhone(phone) {
    return this.get(`/users/by-phone/${encodeURIComponent(phone)}`);
  }

  /**
   * TRANSAÇÕES (LANÇAMENTOS)
   */
  async createTransaction(data) {
    return this.post("/transactions", data);
  }

  async getTransactions(params = {}) {
    return this.get("/transactions", params);
  }

  async getTransactionById(id) {
    return this.get(`/transactions/${id}`);
  }

  async updateTransaction(id, data) {
    return this.put(`/transactions/${id}`, data);
  }

  async deleteTransaction(id) {
    return this.delete(`/transactions/${id}`);
  }

  /**
   * CONTAS BANCÁRIAS (BANCOS)
   */
  async createAccount(data) {
    return this.post("/banks", data);
  }

  async getAccounts(userId = null) {
    const params = userId ? { user_id: userId } : {};
    return this.get("/banks", params);
  }

  async getAccountById(id) {
    return this.get(`/banks/${id}`);
  }

  async updateAccount(id, data) {
    return this.put(`/banks/${id}`, data);
  }

  async deleteAccount(id) {
    return this.delete(`/banks/${id}`);
  }

  /**
   * CATEGORIAS
   */
  async getCategories(userId = null, type = null) {
    const params = {};
    if (userId) params.user_id = userId;
    if (type) params.type = type;
    return this.get("/categories", params);
  }

  async createCategory(data) {
    return this.post("/categories", data);
  }

  /**
   * RELATÓRIOS
   */
  async getSummaryReport(startDate, endDate) {
    return this.get("/reports/summary", { startDate, endDate });
  }

  async getCategoryReport(startDate, endDate, type = null) {
    const params = { startDate, endDate };
    if (type) params.type = type;
    return this.get("/reports/by-category", params);
  }

  async getMonthlyReport(year, month) {
    return this.get("/reports/monthly", { year, month });
  }
}

// Exportar instância única (singleton)
export const apiClient = new ConectFinAPI();

// Exportar classe para testes
export { ConectFinAPI };
