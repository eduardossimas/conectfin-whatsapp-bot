/**
 * Serviço de IA - Centraliza todas as chamadas para OpenAI e Gemini
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "../config/environment.js";
import { sleep } from "../utils/helpers.js";

// Setup __dirname para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Inicializar clientes de IA
const openai = config.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: config.OPENAI_API_KEY })
  : null;

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

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
};

// ========================= LLM CORE ========================

/**
 * Função principal para executar LLM
 * Tenta Gemini primeiro (gratuito), depois OpenAI como fallback
 * 
 * @param {string} system - Prompt do sistema
 * @param {Array} userParts - Array de partes (texto ou inlineData)
 * @param {number} retryCount - Contador de tentativas
 * @returns {Promise<string>} - Resposta da IA (JSON limpo)
 */
export async function runLLM(system, userParts, retryCount = 0) {
  const maxRetries = 3;
  
  // Tentativa 1: Gemini (PRIORIDADE - créditos gratuitos)
  try {
    return await runLLMGemini(system, userParts, retryCount);
  } catch (error) {
    console.error(`❌ [AI] Erro com Gemini:`, error.message);
    
    // Se Gemini falhou e OpenAI está disponível, usa como fallback
    if (openai) {
      console.log(`🔄 [AI] Gemini falhou, tentando OpenAI como fallback...`);
      return runLLMOpenAI(system, userParts);
    }
    
    // Se não tem OpenAI disponível, relança erro do Gemini
    throw error;
  }
}

/**
 * Função específica para OpenAI (fallback quando Gemini falha)
 * 
 * @param {string} system - Prompt do sistema
 * @param {Array} userParts - Array de partes (texto ou inlineData)
 * @returns {Promise<string>} - Resposta da IA (JSON limpo)
 */
async function runLLMOpenAI(system, userParts) {
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
    
    const response = await openai.chat.completions.create({
      model: config.OPENAI_MODEL,
      messages: messages,
      temperature: 0.1, // Mais determinístico para parsing
      max_tokens: 1000
    });
    
    const txt = response.choices[0].message.content.trim();
    console.log(`✅ [AI] Resposta obtida com sucesso usando OpenAI (${config.OPENAI_MODEL})`);
    console.log(`📊 [AI] Tokens usados: ${response.usage.total_tokens} (prompt: ${response.usage.prompt_tokens}, completion: ${response.usage.completion_tokens})`);
    
    // remove cercas ```json
    return txt.replace(/```json|```/g, "").trim();
    
  } catch (error) {
    console.error(`❌ [AI] Erro com OpenAI:`, error.message);
    throw error;
  }
}

/**
 * Função específica para Gemini (fallback)
 * 
 * @param {string} system - Prompt do sistema
 * @param {Array} userParts - Array de partes do Gemini
 * @param {number} retryCount - Contador de tentativas
 * @returns {Promise<string>} - Resposta da IA (JSON limpo)
 */
async function runLLMGemini(system, userParts, retryCount = 0) {
  const maxRetries = 2;
  const modelToUse = retryCount === 0 ? config.GEMINI_PRIMARY : config.GEMINI_FALLBACK;
  
  console.log(`🤖 [AI] Tentativa Gemini ${retryCount + 1}/${maxRetries + 1} - Modelo: ${modelToUse}`);
  
  try {
    const model = genAI.getGenerativeModel({
      model: modelToUse,
      systemInstruction: system,
    });
    
    const res = await model.generateContent({
      contents: [{ role: "user", parts: userParts }],
    });
    
    const txt = res.response.text().trim();
    console.log(`✅ [AI] Resposta obtida com sucesso usando Gemini (${modelToUse})`);
    
    // remove cercas ```json
    return txt.replace(/```json|```/g, "").trim();
    
  } catch (error) {
    console.error(`❌ [AI] Erro com Gemini (${modelToUse}):`, error.message);
    
    // Se é erro 503 (overloaded) e ainda há tentativas
    if (error.message.includes('503') && retryCount < maxRetries) {
      console.log(`🔄 [AI] Tentando novamente com modelo Gemini fallback...`);
      await sleep(1000);
      return runLLMGemini(system, userParts, retryCount + 1);
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
    
    const jsonStr = await runLLM(PROMPTS.INTENT_CLASSIFIER, [
      { text: `Mensagem do usuário: "${message}"` }
    ]);
    
    const result = JSON.parse(jsonStr);
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
    return categoriasExistentes[0];
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
    console.log(`🤖 [AI-CATEGORY] IA escolheu: "${nomeEscolhido}"`);
    
    return nomeEscolhido;
    
  } catch (error) {
    console.error("❌ [AI-CATEGORY] Erro na IA para categoria:", error);
    return categoriasExistentes[0]; // fallback
  }
}
