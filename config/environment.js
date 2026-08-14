import "dotenv/config";

function normalizeWhatsAppPhone(raw = "") {
  const digits = String(raw)
    .trim()
    .replace(/^whatsapp:/i, "")
    .replace(/@s\.whatsapp\.net$/, "")
    .replace(/@c\.us$/, "")
    .replace(/@lid$/, "")
    .replace(/\D/g, "");

  return digits ? `+${digits}` : "";
}

export function getPhoneVariants(phone = "") {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return [];

  const digits = normalized.replace(/^\+/, "");
  const variants = new Set();

  // Brasil: aceita equivalência entre formatos com e sem nono dígito.
  // Exemplo: +5532991473412 <-> +553291473412
  if (digits.startsWith("55") && (digits.length === 12)) {
    variants.add(`+${digits.slice(0, 4)}9${digits.slice(4)}`);
  }
  variants.add(normalized);
  if (digits.length === 13 && digits.startsWith("55")) {
      variants.add(`+${digits.slice(0, 4)}${digits.slice(5)}`);
  }

  return Array.from(variants);
}

const envAllowedWhatsApp = process.env.ALLOWED_WHATSAPP || "+5532991473412";
const normalizedAllowedWhatsAppList = envAllowedWhatsApp
  .split(",")
  .map((phone) => normalizeWhatsAppPhone(phone))
  .filter(Boolean);

const allowedWhatsAppList = normalizedAllowedWhatsAppList.length
  ? normalizedAllowedWhatsAppList
  : ["+5532991473412"];

export const config = {
  // Server
  PORT: Number(process.env.PORT || 3001),
  
  // WhatsApp Mode
  WHATSAPP_MODE: process.env.WHATSAPP_MODE || 'baileys', // 'baileys' ou 'waba'
  
  // WhatsApp (legacy)
  ALLOWED_WHATSAPP: allowedWhatsAppList[0],
  ALLOWED_WHATSAPP_LIST: allowedWhatsAppList,
  WAHA_URL: process.env.WAHA_URL,
  WA_CLOUD_PHONE_ID: process.env.WA_CLOUD_PHONE_ID,
  WA_CLOUD_TOKEN: process.env.WA_CLOUD_TOKEN,
  
  // WABA - WhatsApp Business API
  WABA_PROVIDER: process.env.WABA_PROVIDER || 'meta',
  WABA_ACCESS_TOKEN: process.env.WABA_ACCESS_TOKEN,
  WABA_PHONE_NUMBER_ID: process.env.WABA_PHONE_NUMBER_ID,
  WABA_BUSINESS_ACCOUNT_ID: process.env.WABA_BUSINESS_ACCOUNT_ID,
  WABA_WEBHOOK_VERIFY_TOKEN: process.env.WABA_WEBHOOK_VERIFY_TOKEN,
  WABA_WEBHOOK_URL: process.env.WABA_WEBHOOK_URL,
  WABA_MEDIA_BASE_URL: process.env.WABA_MEDIA_BASE_URL,
  
  // Twilio (opcional)
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER,
  
  // 360Dialog (opcional)
  DIALOG360_API_KEY: process.env.DIALOG360_API_KEY,
  DIALOG360_CHANNEL_ID: process.env.DIALOG360_CHANNEL_ID,
  
  // Media Storage
  MEDIA_STORAGE: process.env.MEDIA_STORAGE || 'local',
  MEDIA_RETENTION_DAYS: Number(process.env.MEDIA_RETENTION_DAYS || 7),
  
  // ConectFin API
  API_BASE_URL: process.env.API_BASE_URL || 'https://api.conectfin.com.br',
  API_EMAIL: process.env.API_EMAIL,
  API_PASSWORD: process.env.API_PASSWORD,
  
  // AI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  
  // AI Models
  OPENAI_MODEL: "gpt-4.1-mini",
  GEMINI_PRIMARY: "gemini-3.1-flash-lite",
  GEMINI_FALLBACK: "gemini-1.5-flash",
  
  // Message Polish (Groq para reescrever as mensagens de forma mais natural)
  GROQ_MODEL: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  MESSAGE_POLISH_ENABLED: process.env.MESSAGE_POLISH_ENABLED !== "false",
  MESSAGE_POLISH_MIN_LENGTH: Number(process.env.MESSAGE_POLISH_MIN_LENGTH || 40),
  MESSAGE_POLISH_SPLIT_MIN_LENGTH: Number(process.env.MESSAGE_POLISH_SPLIT_MIN_LENGTH || 400),
  MESSAGE_POLISH_BLOCK_DELAY_MS: Number(process.env.MESSAGE_POLISH_BLOCK_DELAY_MS || 500),
};

export { normalizeWhatsAppPhone };

export function isAllowedWhatsAppPhone(phone) {
  const candidates = getPhoneVariants(phone);
  return candidates.some((candidate) => config.ALLOWED_WHATSAPP_LIST.includes(candidate));
}
