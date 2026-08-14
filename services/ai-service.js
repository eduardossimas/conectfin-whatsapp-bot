/**
 * Serviço de IA - Centraliza todas as chamadas para OpenAI e Gemini
 */

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import OpenAI from "openai";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "../config/environment.js";
import { sleep } from "../utils/helpers.js";
import { TOOLS } from "../tools/definitions.js";

// Setup __dirname para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Inicializar clientes de IA
const openai = config.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: config.OPENAI_API_KEY })
  : null;

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

//Cliente Groq gratuito - reutiliza o SDK OpenAi via endpoint compatível
const groqClient = config.GROQ_API_KEY
  ? new OpenAI({ apiKey: config.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" })
  : null;

// ========================= PROMPTS ========================
function loadPrompt(filename) {
  return readFileSync(
    join(__dirname, "..", "prompts", filename),
    "utf-8"
  );
}

export const PROMPTS = {
  PARSER: loadPrompt("system-parser.md"),
  CATEGORY_CLASSIFIER: loadPrompt("system-category-classifier.md"),
  DOCUMENT_ANALYZER: loadPrompt("system-document-analyzer.md"),
  INTENT_CLASSIFIER: loadPrompt("system-intent-classifier.md"),
  AGENT: loadPrompt("system-agent.md"),
  POLISHER: loadPrompt("system-message-polisher.md")
};
const VALID_TOOLS = Object.keys(TOOLS);

// ========================= SCHEMAS PARA STRUCTURED OUTPUT ========================

/**
 * Schema para o Parser de lançamentos financeiros
 */
export const SCHEMAS = {
  PARSER: {
    type: SchemaType.OBJECT,
    properties: {
      descricao: { type: SchemaType.STRING, nullable: true },
      valor: { type: SchemaType.NUMBER, nullable: true },
      tipo_lancamento: { type: SchemaType.STRING, nullable: true, enum: ["receita", "despesa"] },
      data_competencia: { type: SchemaType.STRING, nullable: true },
      data_pagamento: { type: SchemaType.STRING, nullable: true },
      data_vencimento: { type: SchemaType.STRING, nullable: true },
      categoria_sugerida: { type: SchemaType.STRING, nullable: true },
      needs_fix: { type: SchemaType.BOOLEAN },
      missing: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      confidence: { type: SchemaType.NUMBER },
      suggestions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
    },
    required: ["needs_fix", "missing", "confidence", "suggestions"]
  },
  
  INTENT_CLASSIFIER: {
    type: SchemaType.OBJECT,
    properties: {
      intent: { 
        type: SchemaType.STRING, 
        enum: ["greeting", "create_transaction", "view_cashflow", "view_dre", "view_payables", "view_receivables", "unknown"] 
      },
      confidence: { type: SchemaType.NUMBER },
      extracted_info: { type: SchemaType.STRING }
    },
    required: ["intent", "confidence", "extracted_info"]
  },
  
  AGENT: {
    type: SchemaType.OBJECT,
    properties: {
      action: { type: SchemaType.STRING, enum: ["call_tool", "respond", "ask_user"] },
      tool: { type: SchemaType.STRING, nullable: true, 
        enum: ["create_transaction", "get_payables", "get_receivables", "get_cashflow", "list_transactions", "analyze_cashflow", "pay_transaction"]},
      parameters_json: { type: SchemaType.STRING, nullable: true, description: "Parâmetros da tool em formato JSON string" },
      message: { type: SchemaType.STRING, nullable: true },
      message_to_user: { type: SchemaType.STRING, nullable: true }
    },
    required: ["action", "tool", "parameters_json", "message", "message_to_user"],
  }
};

/**
 * Schemas para OpenAI (formato JSON Schema)
 */
export const SCHEMAS_OPENAI = {
  PARSER: {
    name: "parser_response",
    strict: true,
    schema: {
      type: "object",
      properties: {
        descricao: { type: ["string", "null"] },
        valor: { type: ["number", "null"] },
        tipo_lancamento: { type: ["string", "null"], enum: ["receita", "despesa", null] },
        data_competencia: { type: ["string", "null"] },
        data_pagamento: { type: ["string", "null"] },
        data_vencimento: { type: ["string", "null"] },
        categoria_sugerida: { type: ["string", "null"] },
        needs_fix: { type: "boolean" },
        missing: { type: "array", items: { type: "string" } },
        confidence: { type: "number" },
        suggestions: { type: "array", items: { type: "string" } }
      },
      required: ["needs_fix", "missing", "confidence", "suggestions", "descricao", "valor", "tipo_lancamento", "data_competencia", "data_pagamento", "data_vencimento", "categoria_sugerida"],
      additionalProperties: false
    }
  },
  
  INTENT_CLASSIFIER: {
    name: "intent_response",
    strict: true,
    schema: {
      type: "object",
      properties: {
        intent: { type: "string", enum: ["greeting", "create_transaction", "view_cashflow", "view_dre", "view_payables", "view_receivables", "unknown"] },
        confidence: { type: "number" },
        extracted_info: { type: "string" }
      },
      required: ["intent", "confidence", "extracted_info"],
      additionalProperties: false
    }
  },
  
  AGENT: {
    name: "agent_response",
    strict: true,
    schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["call_tool", "respond", "ask_user"] },
        tool: { type: ["string", "null"] },
        parameters_json: { type: ["string", "null"], description: "Parâmetros da tool em formato JSON string" },
        message: { type: ["string", "null"] },
        message_to_user: { type: ["string", "null"] }
      },
      required: ["action", "tool", "parameters_json", "message", "message_to_user"],
      additionalProperties: false
    }
  }
};

// ========================= LLM CORE ========================

/**
 * Função principal para executar LLM com structured output
 * Tenta Gemini primeiro (gratuito), depois OpenAI como fallback
 * 
 * @param {string} system - Prompt do sistema
 * @param {Array} userParts - Array de partes (texto ou inlineData)
 * @param {Object} options - Opções adicionais
 * @param {Object} options.schema - Schema Gemini para structured output
 * @param {Object} options.schemaOpenAI - Schema OpenAI para structured output
 * @param {number} retryCount - Contador de tentativas
 * @returns {Promise<Object|string>} - Resposta da IA (objeto se schema, string se não)
 */
export async function runLLM(system, userParts, options = {}, retryCount = 0) {
  const { schema, schemaOpenAI } = options;
  
  // Tentativa 1: Gemini (PRIORIDADE - créditos gratuitos)
  try {
    return await runLLMGemini(system, userParts, { schema }, retryCount);
  } catch (error) {
    console.error(`❌ [AI] Erro com Gemini:`, error.message);
    
    // Se Gemini falhou e OpenAI está disponível, usa como fallback
    if (openai) {
      console.log(`🔄 [AI] Gemini falhou, tentando OpenAI como fallback...`);
      return runLLMOpenAI(system, userParts, { schema: schemaOpenAI });
    }
    
    // Se não tem OpenAI disponível, relança erro do Gemini
    throw error;
  }
}

/**
 * Função específica para OpenAI com structured output
 * 
 * @param {string} system - Prompt do sistema
 * @param {Array} userParts - Array de partes (texto ou inlineData)
 * @param {Object} options - Opções adicionais
 * @returns {Promise<Object|string>} - Resposta da IA
 */
async function runLLMOpenAI(system, userParts, options = {}) {
  const { schema } = options;
  
  try {
    console.log(`🤖 [AI] Usando OpenAI (FALLBACK) - Modelo: ${config.OPENAI_MODEL}`);
    
    // Converter userParts para formato OpenAI
    const messages = [
      { role: "system", content: system }
    ];
    
    // Processar userParts (pode ter texto ou inlineData)
    for (const part of userParts) {
      if (part.text) {
        messages.push({ role: "user", content: part.text });
      } else if (part.inlineData) {
        // OpenAI Vision API para imagens/documentos
        const mimeType = part.inlineData.mimeType || "image/jpeg";
        
        if (mimeType.startsWith("image/")) {
          messages.push({
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${part.inlineData.data}`
                }
              }
            ]
          });
        } else if (mimeType.startsWith("audio/")) {
          // Para áudio, OpenAI usa Whisper separadamente (não suportado inline)
          throw new Error('OpenAI não suporta áudio inline. Use Gemini.');
        } else {
          // Para outros tipos, tenta como imagem
          messages.push({
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${part.inlineData.data}`
                }
              }
            ]
          });
        }
      }
    }
    
    // Configurar request com ou sem structured output
    const requestConfig = {
      model: config.OPENAI_MODEL,
      messages: messages,
      temperature: 0.1,
      max_tokens: 1000
    };
    
    // Se tem schema, usar structured output
    if (schema) {
      requestConfig.response_format = {
        type: "json_schema",
        json_schema: schema
      };
    }
    
    const response = await openai.chat.completions.create(requestConfig);
    
    const txt = response.choices[0].message.content.trim();
    console.log(`✅ [AI] Resposta obtida com sucesso usando OpenAI (${config.OPENAI_MODEL})`);
    console.log(`📊 [AI] Tokens usados: ${response.usage.total_tokens} (prompt: ${response.usage.prompt_tokens}, completion: ${response.usage.completion_tokens})`);
    
    // Se usou structured output, parsear e retornar objeto
    if (schema) {
      try {
        const parsed = JSON.parse(txt);
        console.log(`✅ [AI] Structured output parseado com sucesso`);
        return parsed;
      } catch (parseError) {
        console.error(`❌ [AI] Erro ao parsear structured output:`, parseError.message);
        // Tentar limpar e parsear
        return JSON.parse(sanitizeJsonString(txt));
      }
    }
    
    // Sem schema, retorna texto limpo
    return txt.replace(/```json|```/g, "").trim();
    
  } catch (error) {
    console.error(`❌ [AI] Erro com OpenAI:`, error.message);
    throw error;
  }
}

/**
 * Função específica para Gemini com structured output
 * 
 * @param {string} system - Prompt do sistema
 * @param {Array} userParts - Array de partes do Gemini
 * @param {Object} options - Opções adicionais
 * @param {number} retryCount - Contador de tentativas
 * @returns {Promise<Object|string>} - Resposta da IA
 */
async function runLLMGemini(system, userParts, options = {}, retryCount = 0) {
  const { schema } = options;
  const maxRetries = 2;
  const modelToUse = retryCount === 0 ? config.GEMINI_PRIMARY : config.GEMINI_FALLBACK;
  
  console.log(`🤖 [AI] Tentativa Gemini ${retryCount + 1}/${maxRetries + 1} - Modelo: ${modelToUse}`);
  
  try {
    // Configurar modelo com ou sem structured output
    const modelConfig = {
      model: modelToUse,
      systemInstruction: system,
    };
    
    // Adicionar configuração de geração com schema se disponível
    const generationConfig = {};
    if (schema) {
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseSchema = schema;
    }
    
    const model = genAI.getGenerativeModel(modelConfig, generationConfig);
    
    const res = await model.generateContent({
      contents: [{ role: "user", parts: userParts }],
      generationConfig: schema ? generationConfig : undefined
    });
    
    const txt = res.response.text().trim();
    console.log(`✅ [AI] Resposta obtida com sucesso usando Gemini (${modelToUse})`);
    
    // Se usou structured output, parsear e retornar objeto
    if (schema) {
      try {
        const parsed = JSON.parse(txt);
        console.log(`✅ [AI] Structured output parseado com sucesso`);
        return parsed;
      } catch (parseError) {
        console.error(`❌ [AI] Erro ao parsear structured output Gemini:`, parseError.message);
        // Tentar limpar e parsear
        return JSON.parse(sanitizeJsonString(txt));
      }
    }
    
    // Sem schema, retorna texto limpo
    return txt.replace(/```json|```/g, "").trim();
    
  } catch (error) {
    console.error(`❌ [AI] Erro com Gemini (${modelToUse}):`, error.message);
    
    // Se é erro 503 (overloaded) e ainda há tentativas
    if (error.message.includes('503') && retryCount < maxRetries) {
      console.log(`🔄 [AI] Tentando novamente com modelo Gemini fallback...`);
      await sleep(1000);
      return runLLMGemini(system, userParts, options, retryCount + 1);
    }
    
    // Se é erro 503 mas já esgotou tentativas
    if (error.message.includes('503')) {
      throw new Error('Serviço de IA temporariamente indisponível. Tente novamente em alguns minutos.');
    }
    
    // Para outros erros, relança
    throw error;
  }
}

// ========================= FUNÇÕES ESPECÍFICAS ========================

/**
 * Classifica a intenção do usuário (greeting, create_transaction, view_reports, etc)
 * 
 * @param {string} message - Mensagem do usuário
 * @returns {Promise<{intent: string, confidence: number, extracted_info: string}>}
 */
export async function classifyIntent(message) {
  try {
    console.log(`🎯 [AI-INTENT] Classificando intenção da mensagem: "${message.substring(0, 50)}..."`);
    
    // Usar structured output
    const result = await runLLM(
      PROMPTS.INTENT_CLASSIFIER, 
      [{ text: `Mensagem do usuário: "${message}"` }],
      { schema: SCHEMAS.INTENT_CLASSIFIER, schemaOpenAI: SCHEMAS_OPENAI.INTENT_CLASSIFIER }
    );
    
    // Validar campos obrigatórios
    if (!result.intent) {
      console.warn(`⚠️ [AI-INTENT] Campo 'intent' não retornado, usando 'unknown'`);
      result.intent = "unknown";
    }
    if (typeof result.confidence !== "number") {
      result.confidence = 0.5;
    }
    if (!result.extracted_info) {
      result.extracted_info = "";
    }
    
    console.log(`✅ [AI-INTENT] Intenção identificada: ${result.intent} (confidence: ${result.confidence})`);
    
    return result;
  } catch (error) {
    console.error(`❌ [AI-INTENT] Erro ao classificar intenção:`, error.message);
    return {
      intent: "unknown",
      confidence: 0.0,
      extracted_info: ""
    };
  }
}

/**
 * Analisa documento e retorna resumo
 * 
 * @param {string} documentText - Texto extraído do documento
 * @returns {Promise<string>} - Análise do documento
 */
export async function analyzeDocumentContent(documentText) {
  console.log(`🔍 [DOC-ANALYZER] Iniciando análise de documento...`);
  
  const analysisPrompt = `O documento está em PT-BR. Faça uma análise do que está contido nele e dê um resumo levando em conta as informações serão inseridas em um sistema financeiro.

DOCUMENTO:
${documentText}

Identifique e resuma:
1. Tipo de documento
2. Valores encontrados
3. Datas relevantes
4. Descrição do produto/serviço
5. Se é receita ou despesa
6. Qualquer informação financeira relevante

Seja objetivo e foque em dados que podem virar lançamentos financeiros.`;

  try {
    const analysis = await runLLM(PROMPTS.DOCUMENT_ANALYZER, [
      { text: analysisPrompt }
    ]);
    
    console.log(`✅ [DOC-ANALYZER] Análise concluída: ${analysis.substring(0, 200)}...`);
    return analysis;
    
  } catch (error) {
    console.error(`❌ [DOC-ANALYZER] Erro na análise:`, error);
    return "Não foi possível analisar o documento automaticamente.";
  }
}

/**
 * Encontra melhor categoria usando IA
 * 
 * @param {string} categoriaSugerida - Categoria sugerida pela análise
 * @param {Array} categoriasExistentes - Lista de categorias disponíveis
 * @returns {Promise<string>} - Nome da categoria escolhida
 */
export async function findBestCategory(categoriaSugerida, categoriasExistentes) {
  if (!categoriasExistentes || categoriasExistentes.length === 0) {
    console.log(`❌ [AI-CATEGORY] Nenhuma categoria disponível`);
    return null;
  }

  if (!categoriaSugerida) {
    console.log(`⚠️ [AI-CATEGORY] Sem categoria sugerida, usando primeira disponível`);
    return null;
  }

  const categoriaNames = categoriasExistentes.map(cat => cat.nome);
  
  console.log(`🔍 [AI-CATEGORY] Categoria sugerida: "${categoriaSugerida}"`);
  console.log(`📋 [AI-CATEGORY] Categorias disponíveis: ${categoriaNames.join(', ')}`);
  
  const aiPrompt = `categoria_sugerida: ${categoriaSugerida}

categorias_existentes: ${categoriaNames.join(', ')}`;

  try {
    const response = await runLLM(PROMPTS.CATEGORY_CLASSIFIER, [
      { text: aiPrompt }
    ]);
    
    const nomeEscolhido = response.trim();
    const normalizarNome = (s) => 
      s.trim()
        .replace(/^["'`]+|["'`]+$/g, "")        // remove aspas nas pontas
        .replace(/^[.,;:\s]+|[.,;:\s]+$/g, "")   // remove pontuação/whitespace nas pontas
        .replace(/\s+/g, " ")
        .toLowerCase();
    const nomeLimpo = normalizarNome(nomeEscolhido);
    console.log(`🤖 [AI-CATEGORY] IA escolheu: "${nomeEscolhido}"`);

    const matchExato = categoriasExistentes.find(cat => normalizarNome(cat.nome) === nomeLimpo);
    if (matchExato) return matchExato.nome;

    const matchContido = categoriasExistentes.find(cat =>  
      {const nome = normalizarNome(cat.nome); 
      return nome.includes(nomeLimpo) || nomeLimpo.includes(nome)
    });

    if (matchContido) {
      console.log(`⚠️ [AI-CATEGORY] IA escolheu "${nomeEscolhido}", mas não há correspondência exata. Usando categoria contida: "${matchContido.nome}"`);
      return matchContido.nome;
    }

    console.warn(`⚠️ [AI-CATEGORY] IA escolheu "${nomeEscolhido}", mas não há correspondência.`);

    return null;
    
  } catch (error) {
    console.error("❌ [AI-CATEGORY] Erro na IA para categoria:", error);
    return categoriasExistentes[0]; // fallback
  }
}

/**
*Função para corrigir a parte de caractéres inválidos como acentos que podem quebrar o JSON do structured output.
**/
function sanitizeJsonString(str){
  if (typeof str !== "string") return str;
  return str
    .replace(/```json|```/g, "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove caracteres de controle
    .replace(/[\u2018\u2019\u201C\u201D]/g, "'") // Substitui aspas curvas por simples
    .replace(/\r?\n|\r/g, " ") // Remove quebras de linha
    .trim();
}

function deveFazerRetry(parsed) {
  if (parsed.action === "call_tool") return false;

  const toolDef = TOOLS[parsed.tool];
  if (!toolDef) return true;

  if (!toolDef.required_params || toolDef.required_params.length === 0) return false;

  const params = parsed.parameters || {};
  if (toolDef.param_types?.confirmada && params.confirmada === true) return false;
  if (params.indice != null) return false;

  return !toolDef.required_params.some(p => params[p] !== undefined && params[p] !== null);
}


// ========================= AGENT (NOVO SISTEMA DE TOOLS) ========================

import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Executa o agente inteligente com sistema de tools
 * O agente decide o que fazer baseado no contexto e pode chamar tools
 * 
 * @param {string} userMessage - Mensagem do usuário
 * @param {Array} mediaParts - Partes de mídia (imagens, áudios, etc) - opcional
 * @param {Object} context - Contexto adicional (histórico, user info, etc)
 * @returns {Promise<{ action: string, tool?: string, parameters?: Object, message?: string }>}
 */
export async function runAgent(userMessage, mediaParts = [], context = {}) {
  const today = dayjs.tz(dayjs(), "America/Sao_Paulo");
  const dataHoje = today.format("YYYY-MM-DD");
  const dataOntem = today.subtract(1, "day").format("YYYY-MM-DD");
  
  // Preparar prompt do sistema com datas substituídas
  let systemPrompt = PROMPTS.AGENT
    .replace(/\{\{DATA_HOJE\}\}/g, dataHoje)
    .replace(/\{\{DATA_ONTEM\}\}/g, dataOntem);
  
  // Adicionar contexto do usuário se disponível
  if (context.userName) {
    systemPrompt += `\n\n## Contexto do Usuário\n- Nome: ${context.userName}`;
  }
  
  // Adicionar histórico de conversa se disponível
  if (context.conversationHistory && context.conversationHistory.trim()) {
    systemPrompt += `\n\n## 💬 Histórico da Conversa (mensagens anteriores)\n\`\`\`\n${context.conversationHistory}\n\`\`\`\n\n**IMPORTANTE:** Use este histórico para entender o contexto. Se o usuário responder apenas com um valor ou confirmação, relacione com a pergunta anterior.`;
  }
  
  console.log(`🤖 [AGENT] Processando mensagem: "${userMessage.substring(0, 50)}..."`);
  if (context.conversationHistory) {
    console.log(`💬 [AGENT] Com histórico de ${context.conversationHistory.split('\n').length} linhas`);
  }
  
  // Montar parts para o LLM
  const parts = [];
  
  // Adicionar mídia primeiro (se houver)
  if (mediaParts && mediaParts.length > 0) {
    for (const media of mediaParts) {
      if (media.inlineData) {
        parts.push(media);
      }
    }
    console.log(`📎 [AGENT] ${mediaParts.length} mídia(s) anexada(s)`);
  }
  
  // Adicionar mensagem do usuário
  parts.push({ text: `Mensagem atual do usuário: "${userMessage}"` });
  
  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // Usar structured output para garantir formato correto
      const parsed = await runLLM(
        systemPrompt,
        parts,
        { schema: SCHEMAS.AGENT, schemaOpenAI: SCHEMAS_OPENAI.AGENT }
      );

      console.log(`📤 [AGENT] Resposta estruturada:`, JSON.stringify(parsed).substring(0, 200));

      // ==== Sanitização do campo tool ====
      if (parsed.action === "call_tool") {
        const rawTool = parsed.tool || "";

        if (!parsed.parameters_json && rawTool) {
          const match = rawTool.match(/\{[^}]*\}/);
          if (match) {
            console.log(`🔧 [AGENT] Extraindo parâmetros JSON do campo 'tool'`);
            parsed.parameters_json = match[0];
          }
        }

        if (rawTool && !VALID_TOOLS.includes(rawTool)) {
          const encontrada = VALID_TOOLS.find(t => rawTool.includes(t));
          if (encontrada) {
            console.log(`🔧 [AGENT] Corrigindo tool de "${rawTool}" para "${encontrada}"`);
            parsed.tool = encontrada;
          } else {
            console.warn(`⚠️ [AGENT] Tool inválida: "${rawTool}".`);
            parsed.action = "ask_user";
            parsed.message = "Desculpe, não consegui entender direito. Pode repetir com mais detalhes?";
          }
        }
      }

      // Validar campos obrigatórios
      if (!parsed.action) {
        console.warn(`⚠️ [AGENT] Campo 'action' não retornado, usando 'respond'`);
        parsed.action = "respond";
        parsed.message = parsed.message || "Desculpe, não entendi. Pode reformular sua pergunta?";
      }

      // Normalizar message_to_user para message se necessário
      if (!parsed.message && parsed.message_to_user) {
        parsed.message = parsed.message_to_user;
      }

      // Parsear parameters_json para objeto parameters
      if (parsed.parameters_json) {
        try {
          parsed.parameters = JSON.parse(sanitizeJsonString(parsed.parameters_json));
        } catch (e) {
          console.warn(`⚠️ [AGENT] Não foi possível parsear parameters_json:`, sanitizeJsonString(parsed.parameters_json));
          parsed.parameters = {};
        }
      } else {
        parsed.parameters = {};
      }

      // ===== RETRY CORRETIVO (apenas 1 tentativa extra) =====
      if (attempt === 1 && deveFazerRetry(parsed)) {
        console.log(`🔄 [AGENT] Saída incompleta (tentativa 1), tentando de novo com instrução corretiva...`);
        systemPrompt += `\n\n## ⚠️ INSTRUÇÃO DE CORREÇÃO (tentativa 2)\nNa tentativa anterior você chamou uma tool sem retornar os parâmetros necessários ou com nome inválido. Reavalie a mensagem ATUAL do usuário e o histórico e:\n- Extraia TODOS os dados já fornecidos (ex: tipo, descricao, valor, data_vencimento, data_pagamento) e preencha o campo "parameters_json" como string JSON.\n- Use APENAS o nome exato de uma tool válida: ${VALID_TOOLS.join(", ")}.\n- Se ainda faltar informação, responda com action "ask_user" perguntando apenas o que falta.`;
        continue;
      }

      console.log(`✅ [AGENT] Ação decidida: ${parsed.action}${attempt === 2 ? " (tentativa 2)" : ""}`);

      if (parsed.action === "call_tool") {
        console.log(`🔧 [AGENT] Tool: ${parsed.tool}, Params:`, parsed.parameters);
      }

      return parsed;

    } catch (error) {
      // Falha na 1ª tentativa → tenta 1x com instrução corretiva
      if (attempt === 1) {
        console.log(`🔄 [AGENT] Erro na tentativa 1, tentando com instrução corretiva...`);
        systemPrompt += `\n\n## ⚠️ INSTRUÇÃO DE CORREÇÃO\nVocê deve responder EXATAMENTE no formato JSON esperado, chamando no máximo UMA tool por vez, com o nome exato e o campo "parameters_json" preenchido como string JSON.`;
        continue;
      }

      console.error(`❌ [AGENT] Erro ao executar agente:`, error.message);
      return {
        action: "respond",
        message: "Desculpe, estou tendo dificuldades no momento. Tente novamente em alguns segundos. 🙏"
      };
    }
  }
}

export async function polishedMessageForWhatsApp(text) {
  //fallback seguro: sem key, desligado ou texto curto envia a mensagem original
  if (!groqClient || !config.MESSAGE_POLISH_ENABLED) return [text];
  if (!text || text.trim().length < config.MESSAGE_POLISH_MIN_LENGTH) return [text];

  const isLong = text.length >= config.MESSAGE_POLISH_SPLIT_MIN_LENGTH;

  try{
    console.log(`✨ [POLISH] Polindo mensagem (${text.length} chars)...`);

    const response = await groqClient.chat.completions.create({
      model: config.GROQ_MODEL,
      temperature: 0.4,
      top_p: 0.9,
      max_tokens: 2000,
      response_format: {type: "json_object"},
      messages: [
        { role: "system", content: PROMPTS.POLISHER },
        { role: "user", content: `Mensagem para polir:\n\n${text}` }
      ]
    });

    const raw = response.choices[0].message.content.trim();
    const parsed = JSON.parse(raw);
    let blocks = Array.isArray(parsed) ? parsed : null;
    if (!blocks && parsed && typeof parsed === "object") {
      // Aceitar chave "blocks" em qualquer capitalização (ex: "Blocks", "BLOCKS")
      const key = Object.keys(parsed).find(k => k.toLowerCase() === "blocks");
      if (key) {
        const valor = parsed[key];
        blocks = Array.isArray(valor) ? valor : [valor];
      }
    }
    if (!blocks) blocks = [parsed];

    blocks = blocks.map(b => String(b || "").trim()).filter(Boolean);

    if (blocks.length === 0) return [text];

    //Mensagens curtas não são divididas
    if (!isLong && blocks.length > 1)
      blocks = [blocks.join("\n\n")];

    //Limite de blocos
    if (blocks.length > 3)
      blocks = [blocks.join("\n\n")];

    console.log(`✅ [POLISH] Mensagem polida em ${blocks.length} bloco(s)`);
    return blocks;
  } catch (error) {
    console.error(`❌ [POLISH] Erro ao polir mensagem:`, error.message);
  }
  return [text];
}