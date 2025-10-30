#!/usr/bin/env node

/**
 * Script de Setup Rápido - ConectFin Bot
 * 
 * Ajuda você a configurar o bot rapidamente
 */

import readline from 'readline';
import { writeFile } from 'fs/promises';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║         🚀 ConectFin Bot - Setup Rápido                ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('Este assistente vai te ajudar a configurar o bot.\n');
  
  // 1. Modo do WhatsApp
  console.log('1️⃣  MODO DO WHATSAPP\n');
  console.log('Escolha o modo de operação:');
  console.log('  [1] Baileys (WhatsApp Web) - Gratuito, ideal para testes');
  console.log('  [2] WABA (WhatsApp Business API) - Pago, ideal para produção\n');
  
  const modeChoice = await question('Escolha [1 ou 2]: ');
  const mode = modeChoice === '2' ? 'waba' : 'baileys';
  
  // 2. Supabase
  console.log('\n2️⃣  SUPABASE (Banco de Dados)\n');
  console.log('Obtenha em: https://supabase.com/dashboard/project/_/settings/api\n');
  
  const supabaseUrl = await question('Supabase URL: ');
  const supabaseKey = await question('Supabase Service Key: ');
  
  // 3. IA
  console.log('\n3️⃣  INTELIGÊNCIA ARTIFICIAL\n');
  console.log('Configure pelo menos uma das opções:\n');
  
  const geminiKey = await question('Gemini API Key (recomendado): ');
  const openaiKey = await question('OpenAI API Key (opcional): ');
  
  // 4. Número autorizado
  console.log('\n4️⃣  NÚMERO AUTORIZADO\n');
  const allowedPhone = await question('Seu número WhatsApp (ex: +5532991473412): ');
  
  // 5. WABA (se escolheu)
  let wabaProvider = '';
  let wabaConfig = {};
  
  if (mode === 'waba') {
    console.log('\n5️⃣  CONFIGURAÇÃO WABA\n');
    console.log('Escolha o provedor:');
    console.log('  [1] Meta Cloud API (Recomendado - grátis até 1000 conversas/mês)');
    console.log('  [2] Twilio (Pago - setup mais simples)');
    console.log('  [3] 360Dialog (Pago - Europa)\n');
    
    const providerChoice = await question('Escolha [1, 2 ou 3]: ');
    
    if (providerChoice === '2') {
      wabaProvider = 'twilio';
      console.log('\nConfigurações Twilio:\n');
      wabaConfig.TWILIO_ACCOUNT_SID = await question('Account SID: ');
      wabaConfig.TWILIO_AUTH_TOKEN = await question('Auth Token: ');
      wabaConfig.TWILIO_PHONE_NUMBER = await question('Phone Number (ex: +14155238886): ');
      
    } else if (providerChoice === '3') {
      wabaProvider = '360dialog';
      console.log('\nConfigurações 360Dialog:\n');
      wabaConfig.DIALOG360_API_KEY = await question('API Key: ');
      
    } else {
      wabaProvider = 'meta';
      console.log('\nConfigurações Meta Cloud API:\n');
      wabaConfig.WABA_ACCESS_TOKEN = await question('Access Token: ');
      wabaConfig.WABA_PHONE_NUMBER_ID = await question('Phone Number ID: ');
      wabaConfig.WABA_BUSINESS_ACCOUNT_ID = await question('Business Account ID: ');
      wabaConfig.WABA_WEBHOOK_VERIFY_TOKEN = await question('Webhook Verify Token: ');
    }
    
    console.log('\n📡 URLs públicas:\n');
    wabaConfig.WABA_WEBHOOK_URL = await question('Webhook URL (ex: https://seu-dominio.com/webhook/whatsapp): ');
    wabaConfig.WABA_MEDIA_BASE_URL = await question('Media Base URL (ex: https://seu-dominio.com/media): ');
    
    console.log('\n📦 Armazenamento de mídia:\n');
    console.log('  [1] Local (apenas desenvolvimento)');
    console.log('  [2] Supabase Storage');
    console.log('  [3] AWS S3');
    console.log('  [4] Cloudinary\n');
    
    const storageChoice = await question('Escolha [1, 2, 3 ou 4]: ');
    let mediaStorage = 'local';
    
    if (storageChoice === '2') {
      mediaStorage = 'supabase';
    } else if (storageChoice === '3') {
      mediaStorage = 's3';
      console.log('\nConfigurações AWS S3:\n');
      wabaConfig.AWS_REGION = await question('Region (ex: us-east-1): ');
      wabaConfig.AWS_ACCESS_KEY_ID = await question('Access Key ID: ');
      wabaConfig.AWS_SECRET_ACCESS_KEY = await question('Secret Access Key: ');
      wabaConfig.AWS_S3_BUCKET = await question('Bucket Name: ');
    } else if (storageChoice === '4') {
      mediaStorage = 'cloudinary';
      console.log('\nConfigurações Cloudinary:\n');
      wabaConfig.CLOUDINARY_CLOUD_NAME = await question('Cloud Name: ');
      wabaConfig.CLOUDINARY_API_KEY = await question('API Key: ');
      wabaConfig.CLOUDINARY_API_SECRET = await question('API Secret: ');
    }
    
    wabaConfig.MEDIA_STORAGE = mediaStorage;
  }
  
  // Gerar .env
  console.log('\n📝 Gerando arquivo .env...\n');
  
  let envContent = `# =========================================================
# CONECTFIN BOT - Configuração Gerada Automaticamente
# =========================================================

# ---------------------------------------------------------
# 1. MODO DO WHATSAPP
# ---------------------------------------------------------
WHATSAPP_MODE=${mode}

# ---------------------------------------------------------
# 2. SERVIDOR
# ---------------------------------------------------------
PORT=3000
NODE_ENV=development
ALLOWED_WHATSAPP=${allowedPhone}

# ---------------------------------------------------------
# 3. SUPABASE (Banco de Dados)
# ---------------------------------------------------------
SUPABASE_URL=${supabaseUrl}
SUPABASE_SERVICE_ROLE=${supabaseKey}

# ---------------------------------------------------------
# 4. INTELIGÊNCIA ARTIFICIAL
# ---------------------------------------------------------
`;

  if (geminiKey) {
    envContent += `GEMINI_API_KEY=${geminiKey}\n`;
  }
  
  if (openaiKey) {
    envContent += `OPENAI_API_KEY=${openaiKey}\n`;
  }
  
  if (mode === 'waba') {
    envContent += `\n# ---------------------------------------------------------
# 5. WABA - WhatsApp Business API
# ---------------------------------------------------------
WABA_PROVIDER=${wabaProvider}
`;
    
    for (const [key, value] of Object.entries(wabaConfig)) {
      envContent += `${key}=${value}\n`;
    }
  }
  
  await writeFile('.env', envContent);
  
  console.log('✅ Arquivo .env criado com sucesso!\n');
  
  // Instruções finais
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║         ✅ CONFIGURAÇÃO CONCLUÍDA!                         ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('📋 PRÓXIMOS PASSOS:\n');
  
  if (mode === 'baileys') {
    console.log('1. Execute o bot:');
    console.log('   npm run dev\n');
    console.log('2. Escaneie o QR Code que aparecer no terminal\n');
    console.log('3. Envie uma mensagem para o bot no WhatsApp\n');
  } else {
    console.log('1. Configure o webhook no provedor WABA\n');
    
    if (wabaProvider === 'meta') {
      console.log('   - Acesse: https://developers.facebook.com/apps/');
      console.log('   - Vá em WhatsApp → Configuração → Webhooks');
      console.log(`   - URL: ${wabaConfig.WABA_WEBHOOK_URL}`);
      console.log(`   - Token: ${wabaConfig.WABA_WEBHOOK_VERIFY_TOKEN}\n`);
    }
    
    console.log('2. Execute o bot:');
    console.log('   npm run waba\n');
    console.log('3. Envie uma mensagem para o número do WhatsApp Business\n');
  }
  
  console.log('💡 DICAS:\n');
  console.log('- Veja os logs detalhados no terminal');
  console.log('- Para trocar de modo, edite WHATSAPP_MODE no .env');
  console.log('- Consulte MIGRATION_GUIDE.md para mais detalhes sobre WABA\n');
  
  console.log('🆘 PROBLEMAS?\n');
  console.log('- Revise o arquivo .env');
  console.log('- Consulte README-NEW.md');
  console.log('- Veja os logs de erro no terminal\n');
  
  rl.close();
}

setup().catch(error => {
  console.error('\n❌ Erro durante o setup:', error);
  rl.close();
  process.exit(1);
});
