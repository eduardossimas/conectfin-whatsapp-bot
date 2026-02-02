/**
 * Analisador de Texto - Processa texto livre
 */

import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { runLLM, PROMPTS, SCHEMAS, SCHEMAS_OPENAI } from "../services/ai-service.js";

// Configurar timezone
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Analisa texto livre e extrai informações financeiras
 * 
 * @param {string} text - Texto enviado pelo usuário
 * @returns {Promise<Object>} - Dados extraídos
 */
export async function analyzeFreeText(text) {
  console.log(`📝 [TEXT-ANALYZER] Iniciando análise de texto: "${text.substring(0, 50)}..."`);
  
  // Usar timezone de São Paulo para garantir data correta
  const today = dayjs.tz(dayjs(), "America/Sao_Paulo").format("YYYY-MM-DD");
  const prompt = `NOW_ISO="${today}", text="${text}"`;
  
  // Usar structured output para garantir formato correto
  const result = await runLLM(
    PROMPTS.PARSER, 
    [{ text: prompt }],
    { schema: SCHEMAS.PARSER, schemaOpenAI: SCHEMAS_OPENAI.PARSER }
  );
  
  // Validar campos obrigatórios
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
  
  console.log(`✅ [TEXT-ANALYZER] Análise concluída`);
  
  return result;
}
