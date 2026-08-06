/**
 * Definição das Tools disponíveis para o Agente
 * Essas definições são usadas tanto para o prompt quanto para validação
 */

export const TOOLS = {
  create_transaction: {
    name: "create_transaction",
    description: "Cria um lançamento financeiro (receita ou despesa) no sistema",
    required_params: ["tipo", "descricao", "valor"],
    optional_params: ["data_competencia", "data_pagamento", "data_vencimento", "categoria_sugerida", "confirmada"],
    param_types: {
      tipo: { type: "string", enum: ["receita", "despesa"] },
      descricao: { type: "string", maxLength: 140 },
      valor: { type: "number", min: 0.01 },
      data_competencia: { type: "date", format: "YYYY-MM-DD" },
      data_pagamento: { type: "date", format: "YYYY-MM-DD", nullable: true },
      data_vencimento: { type: "date", format: "YYYY-MM-DD", nullable: true },
      categoria_sugerida: { type: "string", nullable: true },
      confirmada: {type: "boolean", default: false}
    }
  },
  
  get_payables: {
    name: "get_payables",
    description: "Lista todas as contas a pagar (despesas pendentes) do usuário",
    required_params: [],
    optional_params: ["limit"],
    param_types: {
      limit: { type: "number", default: 20, max: 100 }
    }
  },
  
  get_receivables: {
    name: "get_receivables",
    description: "Lista todas as contas a receber (receitas pendentes) do usuário",
    required_params: [],
    optional_params: ["limit"],
    param_types: {
      limit: { type: "number", default: 20, max: 100 }
    }
  },
  
  get_cashflow: {
    name: "get_cashflow",
    description: "Gera relatório de fluxo de caixa do período especificado com gráfico visual",
    required_params: [],
    optional_params: ["periodo", "start_date", "end_date"],
    param_types: {
      periodo: { type: "string", description: "Período em linguagem natural (ex: 'janeiro 2026', 'este mês')" },
      start_date: { type: "date", format: "YYYY-MM-DD" },
      end_date: { type: "date", format: "YYYY-MM-DD" }
    }
  },
  
  list_transactions: {
    name: "list_transactions",
    description: "Lista lançamentos detalhados do período (receitas e despesas)",
    required_params: [],
    optional_params: ["periodo", "tipo", "limit"],
    param_types: {
      periodo: { type: "string", description: "Período em linguagem natural (ex: 'janeiro 2026', 'este mês', 'últimos 7 dias')" },
      tipo: { type: "string", enum: ["receita", "despesa", "todos"], description: "Filtrar por tipo" },
      limit: { type: "number", default: 20, max: 50 }
    }
  },
  
  analyze_cashflow: {
    name: "analyze_cashflow",
    description: "Analisa o fluxo de caixa e fornece insights e recomendações financeiras",
    required_params: [],
    optional_params: ["periodo"],
    param_types: {
      periodo: { type: "string", description: "Período para análise" }
    }
  },

  pay_transaction: {
    name: "pay_transaction",
    description: "Marca um lançamento pendente como pago/recebido, atualizando a conta já existente em vez de criar uma duplicada",
    required_params: ["descricao"],
    optional_params: ["tipo", "valor", "data_pagamento", "indice"],
    param_types: {
      descricao: { type: "string", maxLength: 140 },
      tipo: { type: "string", enum: ["receita", "despesa"] },
      valor: { type: "number", min: 0.01 },
      data_pagamento: { type: "date", format: "YYYY-MM-DD", nullable: true },
      indice: { type: "number", min: 1, max: 5}
    }
  }
};

/**
 * Valida os parâmetros de uma chamada de tool
 * 
 * @param {string} toolName - Nome da tool
 * @param {Object} params - Parâmetros fornecidos
 * @returns {{ valid: boolean, errors: string[], missing: string[] }}
 */
export function validateToolParams(toolName, params = {}) {
  const tool = TOOLS[toolName];
  
  if (!tool) {
    return {
      valid: false,
      errors: [`Tool "${toolName}" não existe`],
      missing: []
    };
  }
  
  const errors = [];
  const missing = [];
  
  // Verificar parâmetros obrigatórios
const temConfirmada = tool.param_types?.confirmada;
const temIndice = params.indice != null;
if ((temConfirmada && params.confirmada === true) || temIndice) {
  // skip obrigatórios — pending tem os dados ou o candidato vem da lista de escolha
} else {
  for (const requiredParam of tool.required_params) {
    if (params[requiredParam] === undefined || params[requiredParam] === null) {
      missing.push(requiredParam);
    }
  }
}

if (temConfirmada && params.confirmada === true) {
  // skip obrigatórios
} else if (temIndice) {
  // skip obrigatórios (descricao) — o candidato vem da lista guardada
} else {
  // valida required_params
}
  
  // Validar tipos dos parâmetros fornecidos
  for (const [paramName, paramValue] of Object.entries(params)) {
    const paramType = tool.param_types[paramName];
    
    if (!paramType) {
      // Parâmetro desconhecido, ignorar
      continue;
    }
    
    // Validar tipo
    if (paramType.type === "number" && typeof paramValue !== "number") {
      errors.push(`"${paramName}" deve ser um número`);
    }
    
    if (paramType.type === "string" && typeof paramValue !== "string") {
      errors.push(`"${paramName}" deve ser uma string`);
    }
    
    // Validar enum
    if (paramType.enum && !paramType.enum.includes(paramValue)) {
      errors.push(`"${paramName}" deve ser um de: ${paramType.enum.join(", ")}`);
    }
    
    // Validar min/max
    if (paramType.min !== undefined && paramValue < paramType.min) {
      errors.push(`"${paramName}" deve ser no mínimo ${paramType.min}`);
    }
    
    if (paramType.max !== undefined && paramValue > paramType.max) {
      errors.push(`"${paramName}" deve ser no máximo ${paramType.max}`);
    }
    
    if (paramType.maxLength !== undefined && typeof paramValue === "string" && paramValue.length > paramType.maxLength) {
      errors.push(`"${paramName}" deve ter no máximo ${paramType.maxLength} caracteres`);
    }
  }
  
  return {
    valid: missing.length === 0 && errors.length === 0,
    errors,
    missing
  };
}

/**
 * Retorna mensagem amigável para parâmetros faltantes
 * 
 * @param {string} toolName - Nome da tool
 * @param {string[]} missing - Lista de parâmetros faltantes
 * @returns {string}
 */
export function getMissingParamsMessage(toolName, missing) {
  const messages = {
    create_transaction: {
      valor: "Qual foi o valor?",
      descricao: "Pode me dar uma descrição breve?",
      tipo: "Foi uma despesa ou receita?"
    }
  };
  
  const toolMessages = messages[toolName] || {};
  
  if (missing.length === 1 && toolMessages[missing[0]]) {
    return toolMessages[missing[0]];
  }
  
  const missingFormatted = missing.map(m => {
    const readable = {
      valor: "valor",
      descricao: "descrição",
      tipo: "tipo (receita ou despesa)",
      data_competencia: "data"
    };
    return readable[m] || m;
  });
  
  return `Preciso de mais algumas informações: ${missingFormatted.join(", ")}`;
}
