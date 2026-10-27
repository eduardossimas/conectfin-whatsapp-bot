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
- **Baileys** - Conexão com WhatsApp Web (desenvolvimento)
- **WABA** - WhatsApp Business API (produção)
- **Google Gemini 2.0 Flash Lite** - Inteligência Artificial (primário)
- **OpenAI GPT-4o-mini** - IA (fallback)
- **API REST** - Integração com ConectFin
- **Node.js** - Backend com ES Modules
- **Canvas** - Geração de gráficos

---

## ✨ Funcionalidades

### ✅ Implementadas:

#### 💬 Conversação Inteligente
- **Memória de conversa** - Bot lembra contexto das últimas mensagens (10 mensagens, 30min)
- **Linguagem natural** - Entende mensagens informais e coloquiais
- **Respostas humanizadas** - Tom amigável e empático

#### 💰 Gestão de Lançamentos
- **Criar receitas** - "Recebi 1000 do cliente X"
- **Criar despesas** - "Paguei 50 de mercado ontem"
- **Via áudio** - Envie mensagem de voz descrevendo
- **Via imagem** - Envie foto de nota fiscal/recibo
- **Via PDF** - Envie boleto ou fatura
- **Categorização automática** - IA escolhe melhor categoria

#### 💸 Contas a Pagar
- **Listar despesas pendentes** - "O que tenho a pagar?"
- **Exibe valor e vencimento** - Mostra lista formatada
- **Total consolidado** - Soma todas as contas

#### 💵 Contas a Receber
- **Listar receitas pendentes** - "O que vou receber?"
- **Exibe valor e vencimento** - Mostra lista formatada
- **Total consolidado** - Soma todas as contas

#### 📊 Fluxo de Caixa
- **Gráfico visual** - Imagem PNG com barras de receitas/despesas
- **Linha de saldo** - Mostra evolução do saldo
- **Período flexível** - "Fluxo de caixa de janeiro"
- **Análise automática** - IA analisa e dá insights

#### 📋 Listagem de Transações
- **Por período** - "Transações de dezembro"
- **Por tipo** - "Minhas despesas do mês"
- **Detalhamento** - Descrição, valor, data, status

### 🚧 Em desenvolvimento:

- 📈 **DRE** - Demonstrativo de Resultado do Exercício
- 📉 **Relatórios avançados** - Análises por categoria

---

## 🏗️ Arquitetura

### Nova Arquitetura: Agent-Based com Tools

O bot utiliza um sistema de **Agente com Tools** onde a IA decide qual ferramenta usar baseado na conversa.

```
conectfin-bot/
├── config/              → Configurações (API keys, URLs)
├── services/            → Serviços (IA, WhatsApp, Database, Memória)
├── handlers/            → Processadores de mensagens
├── analyzers/           → Analisadores (texto/mídia)
├── tools/               → Definições e Executores de Tools
├── utils/               → Funções auxiliares
├── prompts/             → Prompts de IA
├── baileys_auth/        → Credenciais WhatsApp (auto-gerado)
└── index.js             → Arquivo principal
```

**Fluxo de mensagens (Agent-Based):**
```
WhatsApp → agent-router → runAgent (IA) → decide ação → executar tool → resposta
                ↓
         conversation-memory (contexto)
```

### Tools Disponíveis:

| Tool | Descrição |
|------|-----------|
| `create_transaction` | Cria lançamento (receita/despesa) |
| `get_payables` | Lista contas a pagar |
| `get_receivables` | Lista contas a receber |
| `get_cashflow` | Gera fluxo de caixa com gráfico |
| `analyze_cashflow` | Analisa situação financeira |
| `list_transactions` | Lista transações por período |

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

### 2. Atendimento pelo suporte

Configure no `.env` o número que deve receber os pedidos de atendimento:

```env
SUPPORT_CONTACT=+5532991473412
```

Na primeira mensagem de cada cliente cadastrado a cada dia, o bot pergunta se
ele deseja falar com o suporte ou usar o assistente para lançamentos e
relatórios. Ao escolher o suporte, ou sempre que o cliente solicitar falar
com o suporte, as mensagens do cliente ficam pausadas e o bot envia uma
pendência para `SUPPORT_CONTACT`.

Depois de concluir o atendimento, o suporte deve enviar ao bot, a partir do
número configurado, uma mensagem no formato:

```text
Encerrar atendimento '+5511999999999'
```

O cliente recebe a confirmação e volta a poder usar o assistente. O estado é
mantido enquanto o processo do bot estiver em execução.

### 3. Usuário no Sistema

O usuário deve:
1. Estar cadastrado no sistema ConectFin
2. Ter vinculado o número do WhatsApp no perfil (formato E.164: `+5532991473412`)
3. Ter configurado as credenciais (email/senha) no `.env` do bot

Contatos que não possuem cadastro recebem a orientação de cadastro uma única vez por
execução do bot. As mensagens seguintes são ignoradas para evitar poluir a conversa.
Na primeira mensagem, o bot também avisa o contato definido em `support-contact` sobre
a conversa pendente, incluindo o nome do contato quando o WhatsApp o disponibilizar.

### 4. Bancos e Categorias

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

O bot entende linguagem natural! Não precisa de comandos específicos.

### Saudação:
```
Usuário: oi / olá / bom dia
Bot: Olá! 👋 Como posso ajudar com suas finanças hoje?
```

### Criar lançamentos:
```
# Despesas
Usuário: paguei 50 reais de mercado
Usuário: gastei 120 no uber ontem
Usuário: comprei material de escritório por 89,90

# Receitas
Usuário: recebi 1000 do cliente X
Usuário: entrou 5000 de salário hoje
Usuário: vou receber 500 amanhã

# Mídia
🎵 Envie áudio descrevendo o gasto
🖼️ Envie foto de nota fiscal
📄 Envie PDF de boleto/fatura
```

### Contas a pagar/receber:
```
Usuário: o que tenho a pagar?
Usuário: minhas contas a pagar
Usuário: o que vou receber?
Usuário: contas a receber
```

### Fluxo de caixa:
```
Usuário: fluxo de caixa
Usuário: fluxo de caixa de janeiro
Usuário: como está meu caixa?
Bot: [Envia imagem do gráfico + análise]
```

### Listar transações:
```
Usuário: minhas transações de dezembro
Usuário: despesas do mês passado
Usuário: o que lancei essa semana?
```

### Conversa contextual:
```
Usuário: paguei 50 de luz
Bot: É receita ou despesa?
Usuário: despesa
Bot: ✅ Lançamento criado! Despesa de R$ 50,00...
```

---

## 📁 Estrutura do Projeto

### Arquivos Principais:

```
index.js                     → Servidor Express + Inicialização (WABA)
index-unified.js             → Entrada principal (detecta ambiente)
baileys-client.js            → Cliente WhatsApp (Baileys - desenvolvimento)
config/environment.js        → Configurações centralizadas
```

### Services (Serviços):

```
services/
├── ai-service.js            → Chamadas IA (Gemini/OpenAI) + runAgent()
├── whatsapp-service-unified.js → Envio de mensagens (detecta cliente)
├── api-client.js            → Cliente HTTP para API ConectFin
├── database-service.js      → Camada de abstração para dados
├── conversation-memory.js   → Memória de contexto por usuário
└── chart-service-svg.js     → Geração de gráficos com Canvas
```

### Handlers (Processadores):

```
handlers/
├── agent-router.js          → 🧠 Roteador principal (Agent-Based)
├── message-router.js        → Roteador legado (intent-based)
├── greeting-handler.js      → Saudações
├── transaction-handler.js   → Criar lançamentos (legado)
└── reports-handler.js       → Relatórios (legado)
```

### Tools (Ferramentas do Agente):

```
tools/
├── index.js                 → Ponto de entrada das tools
├── definitions.js           → Schemas e validação das tools
└── executors.js             → Implementação das tools
```

### Analyzers (Analisadores):

```
analyzers/
├── text-analyzer.js         → Texto livre
└── media-analyzer.js        → Áudio, imagem, PDF
```

### Prompts (IA):

```
prompts/
├── system-agent.md                 → 🆕 Prompt do Agente (principal)
├── system-parser.md                → Extração de dados
├── system-category-classifier.md   → Classificação de categorias
├── system-document-analyzer.md     → Análise de documentos
└── system-intent-classifier.md     → Classificação de intenção (legado)
```

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

### Erro de IA "401 Unauthorized" ou "ACCESS_TOKEN_TYPE_UNSUPPORTED":

`GEMINI_API_KEY` precisa ser uma chave de API do Google AI Studio. Não use token OAuth, access token, chave de serviço ou credencial do Google Cloud nessa variável.

1. Gere uma chave em <https://aistudio.google.com/apikey>
2. Atualize `GEMINI_API_KEY` no arquivo `.env`
3. Reinicie o bot após alterar o `.env`

Se a chave tiver sido exposta em logs, commits ou mensagens, revogue-a e gere outra antes de continuar.

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

### Adicionar nova Tool:

1. **Defina a tool** em `tools/definitions.js`:
```javascript
tool_name: {
  name: 'tool_name',
  description: 'O que a tool faz',
  requiredParams: ['param1'],
  optionalParams: ['param2']
}
```

2. **Implemente o executor** em `tools/executors.js`:
```javascript
async function executeToolName(params, context) {
  // Implementação
  return { success: true, data: {}, message: "Resposta" };
}
```

3. **Registre no switch** em `tools/index.js`

4. **Atualize o prompt** em `prompts/system-agent.md`

### Ajustar comportamento do Agente:

Edite `prompts/system-agent.md` para:
- Mudar tom de voz
- Adicionar regras de negócio
- Definir quando usar cada tool

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
