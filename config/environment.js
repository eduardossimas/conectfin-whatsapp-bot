import "dotenv/config";

export const config = {
  // Server
  PORT: Number(process.env.PORT || 3000),
  
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
  
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE,
  
  // AI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  
  // AI Models
  OPENAI_MODEL: "gpt-4o-mini",
  GEMINI_PRIMARY: "gemini-2.0-flash-exp",
  GEMINI_FALLBACK: "gemini-1.5-flash",
  
  // User
  USER_ID: "5b15bf69-c0ba-4959-a1fc-cb5c1cd32e73",
};
