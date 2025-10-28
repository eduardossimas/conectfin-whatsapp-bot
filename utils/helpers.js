/**
 * Funções auxiliares do sistema
 */

import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

// Configurar plugins do dayjs
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

// Definir timezone padrão do Brasil
dayjs.tz.setDefault("America/Sao_Paulo");

/**
 * Aguarda um tempo determinado em milissegundos
 * @param {number} ms - Tempo em milissegundos
 * @returns {Promise<void>}
 */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Normaliza um número de telefone para o formato E.164
 * @param {string} raw - Número bruto do telefone
 * @returns {string} - Número normalizado com +
 */
export function normalizePhoneE164(raw = "") {
  let digits = String(raw).replace("@c.us", "").replace(/\D/g, "");
  if (digits && !digits.startsWith("+")) {
    digits = "+" + digits;
  }
  return digits;
}

/**
 * Faz o parse de um Data URL (base64) e retorna buffer + mime type
 * @param {string} dataUrl - Data URL no formato "data:mime/type;base64,..."
 * @returns {{buffer: Buffer, mime: string} | null}
 */
export function parseDataUrl(dataUrl = "") {
  if (!dataUrl || typeof dataUrl !== 'string') {
    console.log(`❌ [DEBUG] parseDataUrl: entrada inválida - ${typeof dataUrl}`);
    return null;
  }
  
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/);
  if (!m) {
    // Tenta verificar se é uma URL HTTP ou base64 puro
    if (dataUrl.startsWith('http')) {
      return null;
    }
    if (/^[A-Za-z0-9+/=]+$/.test(dataUrl)) {
      return { 
        buffer: Buffer.from(dataUrl, "base64"), 
        mime: "application/octet-stream" 
      };
    }
    return null;
  }
  
  const mime = m[1];
  const b64 = m[2];
  return { 
    buffer: Buffer.from(b64, "base64"), 
    mime 
  };
}

/**
 * Extrai o tipo de mídia de um mime type
 * @param {string} mime - Mime type (ex: "image/jpeg")
 * @returns {string} - Tipo genérico ("image", "audio", "video", etc)
 */
export function getMediaType(mime = "") {
  if (!mime) return "unknown";
  return mime.split("/")[0];
}

/**
 * Formata valores monetários para exibição
 * @param {number} value - Valor numérico
 * @returns {string} - Valor formatado (ex: "R$ 1.234,56")
 */
export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

/**
 * Formata data para exibição no padrão brasileiro
 * Corrige problema de timezone ao fazer parse de strings YYYY-MM-DD
 * 
 * @param {Date|string} date - Data a ser formatada (ex: "2025-10-22" ou Date object)
 * @returns {string} - Data formatada (ex: "22/10/2025")
 */
export function formatDate(date) {
  // Se a data vier como string no formato YYYY-MM-DD, faz parse correto
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    // Parse como data local (não UTC) para evitar problema de timezone
    return dayjs(date, "YYYY-MM-DD").format("DD/MM/YYYY");
  }
  
  // Para outros casos (Date object, timestamp, etc)
  return dayjs(date).format("DD/MM/YYYY");
}
