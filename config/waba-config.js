/**
 * Configurações WABA (WhatsApp Business API)
 * 
 * Adicione estas variáveis ao seu .env:
 * 
 * # Meta Cloud API (Oficial - Gratuito com limites)
 * WABA_PROVIDER=meta
 * WABA_ACCESS_TOKEN=seu_token_aqui
 * WABA_PHONE_NUMBER_ID=seu_phone_number_id
 * WABA_WEBHOOK_VERIFY_TOKEN=token_aleatorio_seguro
 * WABA_BUSINESS_ACCOUNT_ID=seu_business_account_id
 * 
 * # Twilio (Pago)
 * WABA_PROVIDER=twilio
 * TWILIO_ACCOUNT_SID=seu_account_sid
 * TWILIO_AUTH_TOKEN=seu_auth_token
 * TWILIO_PHONE_NUMBER=+14155238886
 * 
 * # 360Dialog (Pago)
 * WABA_PROVIDER=360dialog
 * DIALOG360_API_KEY=sua_api_key
 * 
 * # URLs públicas (necessário para WABA)
 * WABA_WEBHOOK_URL=https://seu-dominio.com/webhook/whatsapp
 * WABA_MEDIA_BASE_URL=https://seu-dominio.com/media
 */

export const wabaConfig = {
  // Provedor escolhido
  provider: process.env.WABA_PROVIDER || 'meta',
  
  // Meta Cloud API
  meta: {
    accessToken: process.env.WABA_ACCESS_TOKEN,
    phoneNumberId: process.env.WABA_PHONE_NUMBER_ID,
    businessAccountId: process.env.WABA_BUSINESS_ACCOUNT_ID,
    webhookVerifyToken: process.env.WABA_WEBHOOK_VERIFY_TOKEN,
    apiVersion: 'v18.0'
  },
  
  // Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER
  },
  
  // 360Dialog
  dialog360: {
    apiKey: process.env.DIALOG360_API_KEY
  },
  
  // URLs públicas
  webhookUrl: process.env.WABA_WEBHOOK_URL,
  mediaBaseUrl: process.env.WABA_MEDIA_BASE_URL,
  
  // Configurações gerais
  retryAttempts: 3,
  timeout: 30000 // 30 segundos
};

export default wabaConfig;
