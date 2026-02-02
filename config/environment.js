import "dotenv/config";

export const config = {
  // Server
  PORT: Number(process.env.PORT || 3001),
  
  // WhatsApp Mode
  WHATSAPP_MODE: process.env.WHATSAPP_MODE || 'baileys', // 'baileys' ou 'waba'
  
  // WhatsApp (legacy)
  ALLOWED_WHATSAPP: "+553291473412",
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
  
  // AI Models
  OPENAI_MODEL: "gpt-4.1-mini",
  GEMINI_PRIMARY: "gemini-2.0-flash-lite",
  GEMINI_FALLBACK: "gemini-1.5-flash",
};
