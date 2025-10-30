# 🤖 ConectFin WhatsApp Bot

Bot inteligente para WhatsApp que integra com o sistema ConectFin para gerenciar finanças via mensagens.

## 🎯 Funcionalidades

✅ Análise inteligente de mensagens com IA (Gemini + OpenAI)  
✅ Classificação automática de lançamentos financeiros  
✅ Extração de dados de notas fiscais (OCR/PDF)  
✅ Relatórios de Fluxo de Caixa com gráficos  
✅ Visualização de saldo consolidado  
✅ Suporte a múltiplas contas bancárias  
✅ Análise de períodos específicos (mês anterior, etc)  

## 🔧 Modos de Operação

O bot suporta **dois modos** de conexão com WhatsApp:

### 1. 📱 Baileys (WhatsApp Web)
- **Gratuito**
- Ideal para desenvolvimento e testes
- Requer escanear QR Code
- Pode desconectar ocasionalmente

### 2. 🏢 WABA (WhatsApp Business API)
- **Pago** (Meta: grátis até 1000 conversas/mês)
- Ideal para produção
- Mais estável e confiável
- Suporta múltiplos números
- Requer URL pública (webhook)

Escolha o modo no `.env`:
```bash
WHATSAPP_MODE=baileys  # ou 'waba'
```

## 🚀 Como Usar

### 1. Instalação

```bash
npm install
```

### 2. Configuração

Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

Configure no `.env`:
```bash
# Modo do WhatsApp
WHATSAPP_MODE=baileys  # Para começar

# Supabase (obrigatório)
SUPABASE_URL=sua_url
SUPABASE_SERVICE_ROLE=sua_key

# IA (obrigatório - pelo menos um)
GEMINI_API_KEY=sua_key
OPENAI_API_KEY=sua_key

# Número autorizado
ALLOWED_WHATSAPP=+5532991473412
```

### 3. Executar

#### Modo Baileys (Desenvolvimento)
```bash
npm run dev
# ou
npm run baileys
```

Escaneie o QR Code que aparece no terminal.

#### Modo WABA (Produção)
```bash
npm run waba
```

Certifique-se de ter configurado o webhook no provedor WABA.

#### Modo Unificado (Detecta automaticamente)
```bash
npm run unified
```

## 📋 Migração para WABA

Quer migrar de Baileys para WhatsApp Business API?

👉 **Leia o guia completo**: [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)

Provedores suportados:
- ✅ Meta Cloud API (Recomendado - grátis até 1000 conversas/mês)
- ✅ Twilio (Pago - setup mais simples)
- ✅ 360Dialog (Pago - focado na Europa)

## 🗂️ Estrutura do Projeto

```
conectfin-bot/
├── index.js                  # Versão Baileys (atual)
├── index-unified.js          # Versão unificada (Baileys + WABA)
├── baileys-client.js         # Cliente Baileys
├── waba-client.js            # Cliente WABA (novo!)
│
├── config/
│   ├── environment.js        # Configurações gerais
│   └── waba-config.js        # Configurações WABA (novo!)
│
├── services/
│   ├── ai-service.js         # Gemini + OpenAI
│   ├── database-service.js   # Supabase
│   ├── whatsapp-service.js   # Envio de mensagens (Baileys)
│   ├── whatsapp-service-unified.js  # Versão unificada (novo!)
│   ├── chart-service-svg.js  # Geração de gráficos
│   └── media-storage-service.js  # Upload de mídia (novo!)
│
├── handlers/
│   ├── message-router.js     # Roteamento de mensagens
│   ├── transaction-handler.js # Lançamentos
│   ├── balance-handler.js    # Saldo
│   └── cashflow-handler.js   # Fluxo de caixa
│
├── analyzers/
│   ├── text-analyzer.js      # Análise de texto
│   └── media-analyzer.js     # Análise de imagens/PDFs
│
├── utils/
│   └── date-utils.js         # Funções de data
│
└── prompts/
    └── classification-prompt.js  # Prompts de IA
```

## 🌐 Armazenamento de Mídia (Para WABA)

WABA requer URLs públicas para enviar imagens. Opções disponíveis:

1. **Supabase Storage** (Recomendado se já usa Supabase)
2. **AWS S3** (Mais comum)
3. **Cloudinary** (Simples e gratuito até certo ponto)
4. **Local + ngrok** (Apenas desenvolvimento)

Configure no `.env`:
```bash
MEDIA_STORAGE=supabase  # ou 's3', 'cloudinary', 'local'
```

## 📊 Comandos do Bot

Envie mensagens para o bot:

### Lançamentos
```
Paguei 150 reais no mercado ontem
Recebi 3000 de salário
Comprei gasolina por R$ 200
```

### Consultas
```
Qual meu saldo?
Mostra meu saldo consolidado
Quanto tenho no banco X?
```

### Relatórios
```
Fluxo de caixa
Fluxo de caixa de setembro
Fluxo do mês passado
```

## 🔐 Variáveis de Ambiente

### Obrigatórias
```bash
SUPABASE_URL=                 # URL do projeto Supabase
SUPABASE_SERVICE_ROLE=        # Service key do Supabase
GEMINI_API_KEY=               # Chave do Google Gemini (IA)
ALLOWED_WHATSAPP=             # Seu número autorizado
```

### Opcionais
```bash
OPENAI_API_KEY=               # Chave OpenAI (fallback da IA)
PORT=3000                     # Porta do servidor
```

### WABA (Se usar WhatsApp Business API)
```bash
WHATSAPP_MODE=waba
WABA_PROVIDER=meta            # ou 'twilio', '360dialog'
WABA_ACCESS_TOKEN=            # Token do provedor
WABA_PHONE_NUMBER_ID=         # ID do número (Meta)
WABA_WEBHOOK_VERIFY_TOKEN=    # Token do webhook
WABA_WEBHOOK_URL=             # URL pública do webhook
```

Veja todas as opções em [.env.example](./.env.example)

## 🧪 Testes

### Testar conexão Baileys
```bash
npm run test-baileys
```

### Testar classificação de categoria
```bash
curl -X POST http://localhost:3000/test-category \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "seu_user_id",
    "categoria_sugerida": "Supermercado",
    "tipo_lancamento": "despesa"
  }'
```

### Testar webhook WABA
```bash
# Verificação
curl "http://localhost:3000/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=seu_token&hub.challenge=teste"

# Deve retornar: teste
```

## 🆘 Troubleshooting

### Baileys não conecta
- Certifique-se que escaneou o QR Code dentro de 90 segundos
- Delete a pasta `baileys_auth` e tente novamente
- Verifique se o número não está conectado em outro lugar

### WABA não recebe mensagens
- Verifique se o webhook está verificado no provedor
- Teste se a URL está acessível publicamente
- Veja os logs de webhook no dashboard do provedor

### Erro ao enviar imagens (WABA)
- Configure `MEDIA_STORAGE` corretamente
- Teste se a URL da imagem está acessível
- Para S3, verifique permissões públicas

### IA não funciona
- Verifique se `GEMINI_API_KEY` ou `OPENAI_API_KEY` está configurado
- Veja os logs para identificar qual IA está falhando
- Gemini tem rate limit menor no plano grátis

## 📦 Dependências Principais

- `@whiskeysockets/baileys` - Cliente WhatsApp Web
- `@google/generative-ai` - Google Gemini
- `openai` - OpenAI GPT
- `@supabase/supabase-js` - Banco de dados
- `express` - Servidor HTTP
- `canvas` - Geração de gráficos
- `dayjs` - Manipulação de datas

### Dependências Opcionais (WABA)
- `@aws-sdk/client-s3` - Para usar AWS S3
- `cloudinary` - Para usar Cloudinary

## 🏗️ Arquitetura

```
WhatsApp → Baileys/WABA → Message Router → AI Service → Handlers
                                              ↓
                                         Database Service
                                              ↓
                                           Supabase
```

## 📝 Licença

Privado - ConectFin

## 🤝 Contribuição

Projeto privado. Entre em contato com o time ConectFin.

---

**Desenvolvido com ❤️ para ConectFin**
