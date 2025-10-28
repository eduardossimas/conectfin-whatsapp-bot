import "dotenv/config";

export const config = {
  // Server
  PORT: Number(process.env.PORT || 3000),
  
  // WhatsApp
  ALLOWED_WHATSAPP: "+553291473412",
  WAHA_URL: process.env.WAHA_URL,
  WA_CLOUD_PHONE_ID: process.env.WA_CLOUD_PHONE_ID,
  WA_CLOUD_TOKEN: process.env.WA_CLOUD_TOKEN,
  
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
