# 📋 Guia de Migração: Baileys → WhatsApp Business API (WABA)

## 🎯 Visão Geral

Este guia te ajuda a migrar do **Baileys** (WhatsApp Web) para **WhatsApp Business API (WABA)**.

### ⚖️ Baileys vs WABA

| Característica | Baileys | WABA |
|----------------|---------|------|
| **Custo** | Gratuito | Pago (Meta: grátis até 1000 conversas/mês) |
| **Confiabilidade** | Média (pode desconectar) | Alta (API oficial) |
| **Limite de mensagens** | Ilimitado | Limite por plano |
| **Múltiplos números** | 1 número por instância | Múltiplos números |
| **Suporte oficial** | Não | Sim (Meta/Provedor) |
| **Complexidade** | Baixa | Média |
| **Requer URL pública** | Não | Sim (para webhooks) |
| **Ideal para** | Desenvolvimento/Testes | Produção |

---

## 🚀 Opção 1: Meta Cloud API (Recomendado)

✅ **Gratuito até 1000 conversas/mês**  
✅ **Oficial da Meta (Facebook)**  
✅ **Melhor documentação**

### Passo 1: Criar conta Meta Business

1. Acesse: https://business.facebook.com/
2. Crie uma conta Meta Business (se não tiver)
3. Verifique sua empresa (pode levar alguns dias)

### Passo 2: Criar aplicativo WhatsApp

1. Acesse: https://developers.facebook.com/apps/
2. Clique em **"Criar Aplicativo"**
3. Escolha: **"Outros"** → **"Empresa"**
4. Nome: `ConectFin Bot` (ou o nome que preferir)
5. Adicione o produto **"WhatsApp"**

### Passo 3: Configurar WhatsApp Business

1. No painel do app, vá em **WhatsApp → Início rápido**
2. Escolha ou crie uma **Conta do WhatsApp Business**
3. Adicione um **número de telefone** (precisa ser um número não usado no WhatsApp)
   - Pode ser um número fixo ou celular secundário
   - Você receberá um código SMS para verificação
4. Anote:
   - `WABA_PHONE_NUMBER_ID` (ex: 123456789012345)
   - `WABA_BUSINESS_ACCOUNT_ID` (ex: 987654321098765)

### Passo 4: Gerar Token Permanente

⚠️ **IMPORTANTE**: O token de teste expira em 24h. Você precisa de um **token permanente**.

1. No painel, vá em **Configurações → Configurações básicas**
2. Role até **"Token de acesso do sistema"**
3. Clique em **"Gerar token"**
4. Selecione:
   - **App**: seu app criado
   - **Permissões**: `whatsapp_business_messaging`, `whatsapp_business_management`
   - **Validade**: **60 dias** ou **Nunca expira** (se disponível)
5. Copie o token: `WABA_ACCESS_TOKEN`

### Passo 5: Configurar Webhook

1. No painel, vá em **WhatsApp → Configuração**
2. Em **"Webhooks"**, clique em **"Editar"**
3. Configure:
   - **URL de retorno de chamada**: Sua URL pública (ex: `https://seu-dominio.com/webhook/whatsapp`)
   - **Token de verificação**: Crie um token aleatório e seguro (ex: `meu_token_secreto_123456`)
   - **Campos**: Marque **`messages`**
4. Clique em **"Verificar e salvar"**

> 💡 **Para desenvolvimento local**: Use [ngrok](https://ngrok.com/) para expor sua porta 3000

### Passo 6: Configurar .env

Adicione ao seu `.env`:

```bash
# Trocar modo para WABA
WHATSAPP_MODE=waba
WABA_PROVIDER=meta

# Credenciais Meta
WABA_ACCESS_TOKEN=EAAxxxxxxxxxxxxx  # Token permanente
WABA_PHONE_NUMBER_ID=123456789012345
WABA_BUSINESS_ACCOUNT_ID=987654321098765
WABA_WEBHOOK_VERIFY_TOKEN=meu_token_secreto_123456

# URLs públicas
WABA_WEBHOOK_URL=https://seu-dominio.com/webhook/whatsapp
WABA_MEDIA_BASE_URL=https://seu-dominio.com/media

# Armazenamento de mídia (recomendado: supabase ou s3)
MEDIA_STORAGE=supabase
```

### Passo 7: Testar

```bash
# Usar o novo arquivo unificado
node index-unified.js
```

Envie uma mensagem para o número do WhatsApp Business. Você deve ver:
```
📨 [WEBHOOK] Mensagem recebida!
```

---

## 🌐 Opção 2: Twilio (Pago, mas mais simples)

✅ **Setup mais rápido**  
✅ **Suporte excelente**  
❌ **Mais caro**

### Passo 1: Criar conta Twilio

1. Acesse: https://www.twilio.com/try-twilio
2. Crie uma conta gratuita (recebe $15 de crédito)
3. Verifique seu email e número de telefone

### Passo 2: Configurar WhatsApp Sandbox (Testes)

1. No console, vá em **Messaging → Try it out → Send a WhatsApp message**
2. Siga as instruções para conectar seu WhatsApp ao sandbox
3. Envie a mensagem de código para o número do Twilio

### Passo 3: Obter credenciais

1. No dashboard, copie:
   - `TWILIO_ACCOUNT_SID` (ex: ACxxxxxxxxxxxx)
   - `TWILIO_AUTH_TOKEN` (ex: xxxxxxxxxxxxx)
2. O número de teste é: `+1 415 523 8886` (sandbox)

### Passo 4: Para produção (número próprio)

1. Vá em **Messaging → WhatsApp → Senders**
2. Clique em **"Request to enable my Twilio number for WhatsApp"**
3. Siga o processo de aprovação (demora ~1 semana)
4. Após aprovado, seu número estará disponível

### Passo 5: Configurar Webhook

1. Vá em **Messaging → Settings → WhatsApp Sandbox Settings**
2. Configure:
   - **When a message comes in**: `https://seu-dominio.com/webhook/whatsapp`
   - **Method**: `POST`

### Passo 6: Configurar .env

```bash
WHATSAPP_MODE=waba
WABA_PROVIDER=twilio

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+14155238886  # Sandbox (ou seu número após aprovação)

WABA_WEBHOOK_URL=https://seu-dominio.com/webhook/whatsapp
MEDIA_STORAGE=s3  # Twilio não faz upload, precisa de S3/Cloudinary
```

---

## 🌍 Opção 3: 360Dialog (Europa)

Focado no mercado europeu. Similar ao Meta Cloud API.

1. Acesse: https://www.360dialog.com/
2. Crie uma conta
3. Siga o processo de onboarding
4. Configure no .env:

```bash
WHATSAPP_MODE=waba
WABA_PROVIDER=360dialog
DIALOG360_API_KEY=sua_api_key_aqui
```

---

## 📦 Configurar Armazenamento de Mídia

WABA precisa de URLs públicas para enviar imagens. Escolha uma opção:

### Opção A: Supabase Storage (Recomendado se já usa Supabase)

1. No Supabase, vá em **Storage**
2. Crie um bucket: `whatsapp-media`
3. Configure como **público**
4. No .env:

```bash
MEDIA_STORAGE=supabase
```

### Opção B: AWS S3

1. Crie uma conta AWS
2. Crie um bucket S3
3. Configure permissões públicas
4. No .env:

```bash
MEDIA_STORAGE=s3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=sua_key
AWS_SECRET_ACCESS_KEY=sua_secret
AWS_S3_BUCKET=seu-bucket
```

### Opção C: Cloudinary

1. Crie conta: https://cloudinary.com/
2. No dashboard, copie as credenciais
3. No .env:

```bash
MEDIA_STORAGE=cloudinary
CLOUDINARY_CLOUD_NAME=seu_cloud_name
CLOUDINARY_API_KEY=sua_key
CLOUDINARY_API_SECRET=seu_secret
```

### Opção D: Local + ngrok (Apenas desenvolvimento)

```bash
MEDIA_STORAGE=local
WABA_MEDIA_BASE_URL=https://seu-ngrok.ngrok.io/media
```

---

## 🧪 Testar a Migração

### 1. Verificar configuração

```bash
# Ver modo atual
curl http://localhost:3000/

# Deve retornar:
{
  "status": "online",
  "mode": "waba",
  "provider": "meta"
}
```

### 2. Testar webhook (Meta)

```bash
# Verificação GET
curl "http://localhost:3000/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=meu_token_secreto_123456&hub.challenge=teste123"

# Deve retornar: teste123
```

### 3. Enviar mensagem de teste

Envie uma mensagem para o número do WhatsApp Business. Verifique os logs:

```
📨 [WEBHOOK] Mensagem recebida!
📱 [WABA] De: +5532991473412
📝 [WABA] Tipo: text
💬 [WABA] Texto: Olá bot!
```

---

## 🔄 Migração Gradual (Recomendado)

Você pode manter ambos os modos e alternar conforme necessário:

### Desenvolvimento
```bash
WHATSAPP_MODE=baileys
```

### Produção
```bash
WHATSAPP_MODE=waba
WABA_PROVIDER=meta
```

---

## 🆘 Troubleshooting

### Erro: "Webhook verification failed"
- Verifique se `WABA_WEBHOOK_VERIFY_TOKEN` é igual ao configurado no Meta
- Certifique-se que a URL está acessível publicamente

### Erro: "Invalid access token"
- Gere um token permanente (não use o token de teste de 24h)
- Verifique as permissões do token

### Imagens não enviam
- Verifique se `MEDIA_STORAGE` está configurado
- Teste se a URL pública da imagem está acessível
- Para S3, verifique se o bucket está público

### Webhook não recebe mensagens
- Verifique se o webhook está verificado no Meta
- Teste com ngrok: `ngrok http 3000`
- Veja os logs de webhook no Meta Developer Dashboard

---

## 📚 Recursos Úteis

- [Meta Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Twilio WhatsApp Docs](https://www.twilio.com/docs/whatsapp)
- [360Dialog Docs](https://docs.360dialog.com/)
- [ngrok - Túnel local](https://ngrok.com/)

---

## 💰 Custos Estimados (2024)

### Meta Cloud API
- 1000 conversas/mês: **GRÁTIS**
- Após isso: ~$0.02 - $0.04 por conversa
- Conversa = janela de 24h com cliente

### Twilio
- ~$0.005 por mensagem recebida
- ~$0.005 - $0.02 por mensagem enviada

### 360Dialog
- A partir de €49/mês (ilimitado)

---

## ✅ Checklist de Migração

- [ ] Escolhi um provedor WABA (Meta/Twilio/360Dialog)
- [ ] Criei conta e configurei WhatsApp Business
- [ ] Obtive credenciais (tokens, IDs)
- [ ] Configurei webhook com URL pública
- [ ] Escolhi método de armazenamento de mídia
- [ ] Atualizei arquivo `.env`
- [ ] Testei webhook com curl
- [ ] Enviei mensagem de teste
- [ ] Bot respondeu corretamente
- [ ] Imagens estão sendo enviadas
- [ ] Pronto para produção! 🎉

---

**Dúvidas?** Revise os logs do servidor. Eles são bem detalhados! 🔍
