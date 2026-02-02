/**
 * Analisador de Mídias - Processa áudio, imagem e documentos
 */

import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { createRequire } from "module";
import axios from "axios";
import { runLLM, PROMPTS, SCHEMAS, SCHEMAS_OPENAI, analyzeDocumentContent } from "../services/ai-service.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

// Configurar timezone
dayjs.extend(utc);
dayjs.extend(timezone);

// ========================= ÁUDIO ========================

/**
 * Analisa áudio inline e extrai informações financeiras
 * 
 * @param {Buffer} buffer - Buffer do áudio
 * @param {string} mime - Mime type do áudio
 * @returns {Promise<Object>} - Dados extraídos
 */
export async function analyzeInlineAudio({ buffer, mime }) {
  console.log(`🎵 [AUDIO-ANALYZER] Iniciando análise de áudio`);
  
  const today = dayjs.tz(dayjs(), "America/Sao_Paulo").format("YYYY-MM-DD");
  const base64 = buffer.toString("base64");
  
  // Usar structured output
  const result = await runLLM(
    PROMPTS.PARSER, 
    [
      { inlineData: { data: base64, mimeType: mime || "audio/ogg" } },
      { text: `NOW_ISO="${today}"\nExtraia os campos do áudio acima.` },
    ],
    { schema: SCHEMAS.PARSER, schemaOpenAI: SCHEMAS_OPENAI.PARSER }
  );
  
  // Validar campos obrigatórios
  validateParserResult(result);
  
  console.log(`✅ [AUDIO-ANALYZER] Análise concluída`);
  
  return result;
}

// ========================= IMAGEM ========================

/**
 * Analisa imagem inline e extrai informações financeiras
 * 
 * @param {Buffer} buffer - Buffer da imagem
 * @param {string} mime - Mime type da imagem
 * @param {string} caption - Legenda/texto da mensagem
 * @returns {Promise<Object>} - Dados extraídos
 */
export async function analyzeInlineImage({ buffer, mime, caption = "" }) {
  console.log(`🖼️ [IMAGE-ANALYZER] Iniciando análise de imagem`);
  
  const today = dayjs.tz(dayjs(), "America/Sao_Paulo").format("YYYY-MM-DD");
  const base64 = buffer.toString("base64");
  
  // Usar structured output
  const result = await runLLM(
    PROMPTS.PARSER, 
    [
      { inlineData: { data: base64, mimeType: mime || "image/jpeg" } },
      {
        text: `NOW_ISO="${today}"\nLegenda: ${
          caption || "(sem)"
        }\nA imagem pode ser nota fiscal, comprovante, fatura ou foto de quadro. Extraia os campos.`,
      },
    ],
    { schema: SCHEMAS.PARSER, schemaOpenAI: SCHEMAS_OPENAI.PARSER }
  );
  
  // Validar campos obrigatórios
  validateParserResult(result);
  
  console.log(`✅ [IMAGE-ANALYZER] Análise concluída`);
  
  return result;
}

// ========================= PDF ========================

/**
 * Faz download de PDF de uma URL
 * 
 * @param {string} url - URL do PDF
 * @returns {Promise<{buffer: Buffer, mime: string}>}
 */
async function downloadPdfFromUrl(url) {
  console.log(`🌐 [PDF-DOWNLOAD] Iniciando download de: ${url}`);
  
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'ConectFin-Bot/1.0'
      }
    });
    
    const buffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'application/pdf';
    
    console.log(`✅ [PDF-DOWNLOAD] Download concluído: ${buffer.length} bytes`);
    
    return { buffer, mime: contentType };
    
  } catch (error) {
    console.error(`❌ [PDF-DOWNLOAD] Erro no download:`, error.message);
    throw new Error(`Falha ao baixar PDF: ${error.message}`);
  }
}

/**
 * Analisa PDF e extrai informações financeiras
 * 
 * @param {Buffer} buffer - Buffer do PDF
 * @returns {Promise<Object>} - Dados extraídos
 */
export async function analyzeInlinePdf({ buffer }) {
  console.log(`📄 [PDF-ANALYZER] Iniciando análise de PDF`);
  
  const today = dayjs.tz(dayjs(), "America/Sao_Paulo").format("YYYY-MM-DD");
  
  try {
    // Step 1: Extract text from PDF
    console.log(`📄 [PDF-ANALYZER] Extraindo texto do PDF...`);
    const { text } = await pdfParse(buffer);
    console.log(`📄 [PDF-ANALYZER] Texto extraído: ${text.length} caracteres`);
    
    if (!text || text.trim().length === 0) {
      throw new Error("PDF não contém texto legível");
    }
    
    console.log(`📄 [PDF-ANALYZER] Primeiros 200 chars: "${text.substring(0, 200)}..."`);
    
    // Step 2: Analyze document
    const documentAnalysis = await analyzeDocumentContent(text);
    
    // Step 3: Extract structured data using structured output
    console.log(`🔧 [PDF-ANALYZER] Extraindo dados estruturados...`);
    
    const extractionPrompt = `NOW_ISO="${today}"

ANÁLISE DO DOCUMENTO:
${documentAnalysis}

TEXTO ORIGINAL:
${text.substring(0, 2000)}

Com base na análise acima, extraia os dados financeiros.`;

    const result = await runLLM(
      PROMPTS.PARSER, 
      [{ text: extractionPrompt }],
      { schema: SCHEMAS.PARSER, schemaOpenAI: SCHEMAS_OPENAI.PARSER }
    );
    
    // Validar campos obrigatórios
    validateParserResult(result);
    
    console.log(`✅ [PDF-ANALYZER] Análise completa concluída`);
    
    return result;
    
  } catch (error) {
    console.error(`❌ [PDF-ANALYZER] Erro ao processar PDF:`, error.message);
    
    // Fallback: retorna estrutura básica solicitando manual
    return {
      descricao: "Documento não processado",
      valor: null,
      tipo_lancamento: null,
      data_competencia: today,
      data_pagamento: null,
      data_vencimento: null,
      categoria_sugerida: null,
      needs_fix: true,
      missing: ["valor", "tipo_lancamento", "descricao"],
      confidence: 0.0,
      suggestions: ["Não foi possível processar o documento automaticamente. Por favor, digite as informações manualmente: 'Paguei R$ [valor] de [descrição] em [data]'"]
    };
  }
}

/**
 * Valida e normaliza resultado do parser
 */
function validateParserResult(result) {
  if (typeof result.needs_fix !== "boolean") {
    result.needs_fix = true;
  }
  if (!Array.isArray(result.missing)) {
    result.missing = [];
  }
  if (typeof result.confidence !== "number") {
    result.confidence = 0.5;
  }
  if (!Array.isArray(result.suggestions)) {
    result.suggestions = [];
  }
}
