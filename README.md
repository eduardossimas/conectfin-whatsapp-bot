# 🤖 ConectFin WhatsApp Bot

Assistente financeiro inteligente via WhatsApp para o sistema ConectFin.

## 📋 Índice

- [Sobre](#sobre)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Como Usar](#como-usar)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Manutenção](#manutenção)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Sobre

Bot de WhatsApp que permite gerenciar finanças pelo celular usando **IA para entender mensagens naturais**. Suporta texto, áudio, imagens e PDFs.

### Tecnologias:
- **Baileys** - Conexão com WhatsApp Web
- **OpenAI/Gemini** - Inteligência Artificial
- **API REST** - Integração com ConectFin
- **Node.js** - Backend

---

## ✨ Funcionalidades

### ✅ Implementadas:

- 💬 **Saudações e ajuda** - Responde "oi", "ajuda"
- 💰 **Criar lançamentos** - Via texto, áudio, imagem ou PDF
- 💸 **Contas a pagar** - Lista despesas pendentes
- 💵 **Contas a receber** - Lista receitas pendentes
- 🤖 **Classificação inteligente** - IA identifica intenção automaticamente
- 📂 **Categorização automática** - IA escolhe melhor categoria

### 🚧 Em desenvolvimento:

- 📊 **Fluxo de Caixa** - Gráfico com imagem
- 📈 **DRE** - Gráfico com imagem

---

## 🏗️ Arquitetura

```
conectfin-bot/
├── config/              → Configurações (API keys, URLs)
├── services/            → Serviços (IA, WhatsApp, Database)
├── handlers/            → Processadores de mensagens
├── analyzers/           → Analisadores (texto/mídia)
├── utils/               → Funções auxiliares
├── prompts/             → Prompts de IA (não mexer!)
├── baileys_auth/        → Credenciais WhatsApp (auto-gerado)
└── index.js             → Arquivo principal
```

**Fluxo de mensagens:**
```
WhatsApp → message-router → classificar intenção → handler específico → resposta
```

---

## 📦 Instalação

### Pré-requisitos:
- Node.js 18+
- npm ou yarn
- Conta WhatsApp

### Passo 1: Clone o projeto
```bash
git clone <repo-url>
cd conectfin-bot
```

### Passo 2: Instale dependências
```bash
npm install
```

### Passo 3: Configure variáveis de ambiente
Crie arquivo `.env` na raiz:

```env
# Servidor
PORT=3000

# ConectFin API
API_BASE_URL=https://api.conectfin.com.br
API_EMAIL=seu-email@dominio.com
API_PASSWORD=sua-senha-segura

# IA (configure pelo menos uma)
GEMINI_API_KEY=sua-chave-gemini
OPENAI_API_KEY=sua-chave-openai  # Opcional

# WhatsApp Cloud API (opcional, fallback)
WA_CLOUD_PHONE_ID=seu_phone_id
WA_CLOUD_TOKEN=seu_token

# WAHA (opcional, fallback)
WAHA_URL=http://localhost:3002/api/sendText
```

---

## ⚙️ Configuração

### 1. Número Autorizado

Edite `config/environment.js` e defina o número autorizado:

```javascript
ALLOWED_WHATSAPP: "+5532991473412", // Seu número aqui
```

### 2. Usuário no Sistema

O usuário deve:
1. Estar cadastrado no sistema ConectFin
2. Ter vinculado o número do WhatsApp no perfil (formato E.164: `+5532991473412`)
3. Ter configurado as credenciais (email/senha) no `.env` do bot

### 3. Bancos e Categorias

- Cadastre pelo menos **1 banco** no ConectFin
- Defina um como **principal** (opcional)
- Cadastre **categorias** de despesa e receita

---

## 🚀 Como Usar

### Iniciar o bot:
```bash
npm run dev
```

### Primeira vez:
1. Execute o comando acima
2. **QR Code** aparecerá no terminal
3. Abra WhatsApp no celular → "Aparelhos conectados"
4. Escaneie o QR Code
5. ✅ Pronto! Bot conectado

### Próximas vezes:
- Apenas execute `npm run dev`
- Bot reconecta automaticamente (não precisa escanear QR Code novamente)

---

## 💬 Comandos do Bot

### Saudação:
```
Usuário: oi
Bot: [Menu de ajuda com opções]
```

### Criar lançamento:
```
Usuário: paguei 50 reais de mercado
Bot: ✅ Lançamento criado! ...

Usuário: recebi 1000 do cliente X ontem
Bot: ✅ Lançamento criado! ...

Ou envie:
- 🎵 Áudio descrevendo a despesa
- 🖼️ Foto de nota fiscal
- 📄 PDF de boleto/fatura
```

### Ver contas:
```
Usuário: contas a pagar
Bot: 💸 Contas a Pagar (3) ...

Usuário: contas a receber
Bot: 💰 Contas a Receber (2) ...
```

---

## 📁 Estrutura do Projeto

### Arquivos Principais:

```
index.js                     → Servidor Express + Inicialização
baileys-client.js           → Cliente WhatsApp (Baileys)
config/environment.js       → Configurações centralizadas
```

### Services (Serviços):

```
services/
├── ai-service.js           → Chamadas IA (OpenAI/Gemini)
├── whatsapp-service.js     → Envio de mensagens
├── api-client.js           → Cliente HTTP para API ConectFin
└── database-service.js     → Camada de abstração para dados
```

### Handlers (Processadores):

```
handlers/
├── message-router.js       → 🧠 Roteador principal
├── greeting-handler.js     → Saudações
├── transaction-handler.js  → Criar lançamentos
└── reports-handler.js      → Contas a pagar/receber
```

### Analyzers (Analisadores):

```
analyzers/
├── text-analyzer.js        → Texto livre
└── media-analyzer.js       → Áudio, imagem, PDF
```

### Prompts (IA):

```
prompts/
├── system-parser.md                → Extração de dados
├── system-category-classifier.md   → Classificação de categorias
├── system-document-analyzer.md     → Análise de documentos
└── system-intent-classifier.md     → Classificação de intenção
```

**⚠️ NÃO ALTERE OS PROMPTS sem entender o impacto!**

---

## 🔧 Manutenção

### Pasta `baileys_auth`:

**O que é?**
- Armazena credenciais de autenticação do WhatsApp
- Permite reconexão sem escanear QR Code

**Limpeza automática:**
- ✅ Executa ao iniciar o bot
- ✅ Executa a cada 6 horas
- ✅ Mantém apenas 30 arquivos mais recentes

**Se desconectar frequentemente:**
```bash
# Pare o bot (Ctrl+C)
rm -rf baileys_auth
npm run dev
# Escaneie QR Code novamente
```

### Logs:

O bot mostra logs detalhados:
```
📱 [ROUTER] Nova mensagem
🎯 [ROUTER] Intenção: create_transaction
💰 [TRANSACTION] Criando lançamento
✅ [DATABASE] Lançamento criado ID: 123
```

---

## 🐛 Troubleshooting

### Bot não conecta:

1. Verifique se QR Code apareceu
2. Escaneie dentro de 90 segundos
3. Verifique conexão com internet
4. Delete `baileys_auth` e tente novamente

### Bot não responde:

1. Verifique se número está autorizado em `config/environment.js`
2. Verifique se usuário existe no sistema ConectFin com telefone vinculado
3. Verifique se credenciais da API estão corretas no `.env`
4. Verifique logs no terminal

### Erro "Nenhum banco encontrado":

1. Acesse o ConectFin web
2. Cadastre pelo menos um banco
3. Defina como principal (opcional)
4. Tente novamente

### Erro de IA "503" ou "overloaded":

1. É temporário - serviço da IA sobrecarregado
2. Aguarde alguns minutos
3. Tente novamente
4. Se persistir, troque de GEMINI_PRIMARY para GEMINI_FALLBACK no código

### Datas erradas (um dia a menos):

✅ **Corrigido!** Sistema agora usa timezone `America/Sao_Paulo` corretamente.

Se ainda ocorrer:
1. Verifique se tem os plugins do dayjs instalados
2. Execute: `npm install dayjs`

---

## 🔒 Segurança

### ⚠️ NUNCA compartilhe:

- ❌ Arquivo `.env`
- ❌ Pasta `baileys_auth/`
- ❌ Arquivo `baileys_auth/creds.json`
- ❌ Chaves de API (OpenAI, Gemini, ConectFin)

### ✅ Já configurado no `.gitignore`:

- `.env`
- `baileys_auth/`
- `node_modules/`

---

## 📊 Endpoints API

O bot também expõe alguns endpoints HTTP:

### Health Check:
```bash
GET http://localhost:3000/
```

### Testar classificação de categoria:
```bash
POST http://localhost:3000/test-category
{
  "user_id": "uuid-do-usuario",
  "categoria_sugerida": "Alimentação",
  "tipo_lancamento": "despesa"
}
```

### Verificar usuário:
```bash
GET http://localhost:3000/user-check/+5532991473412
```

---

## 🎨 Personalizando

### Adicionar nova funcionalidade:

1. **Adicione intenção** em `prompts/system-intent-classifier.md`
2. **Crie handler** em `handlers/sua-funcionalidade-handler.js`
3. **Adicione rota** em `handlers/message-router.js`

Exemplo completo no arquivo `REFACTORING-COMPLETED.md` (se existir).

---

## 📝 Comandos NPM

```bash
npm run dev       # Inicia o bot em modo desenvolvimento
npm start         # Inicia o bot em modo produção
npm test          # Executa testes (se configurado)
```

---

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit: `git commit -m 'Adiciona nova funcionalidade'`
4. Push: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

---

## 📄 Licença

[Definir licença do projeto]

---

## 👤 Autor

ConectFin Team

---

## 🆘 Suporte

- 📧 Email: [definir]
- 💬 Discord: [definir]
- 📱 WhatsApp: [definir]

---

**Desenvolvido com ❤️ para facilitar sua gestão financeira!**
