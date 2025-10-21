# ✅ ConectFin Bot - Integrado com Baileys

## 🎉 Bot Pronto e Funcionando!

O bot ConectFin agora está totalmente integrado com o Baileys, sem necessidade de WAHA ou servidores externos.

## 🚀 Como Usar

### 1. Inicie o bot

```bash
node index.js
```

### 2. Escaneie o QR Code

Quando o bot iniciar, um QR Code aparecerá no terminal (se for a primeira vez):

1. Abra o WhatsApp no celular
2. Vá em **Configurações** → **Dispositivos conectados**
3. Toque em **Conectar dispositivo**
4. Escaneie o QR Code

### 3. Envie mensagens!

Envie mensagens do número **+553291473412** (configurado como autorizado) e o bot irá:

- ✅ Processar mensagens de texto
- ✅ Analisar imagens (notas fiscais, comprovantes)
- ✅ Transcrever áudios
- ✅ Ler PDFs
- ✅ Criar lançamentos automáticos no Supabase
- ✅ Classificar em categorias com IA
- ✅ Enviar confirmação

## 📊 O que foi integrado

### ✨ Funcionalidades

| Recurso | Status |
|---------|--------|
| Conexão via Baileys | ✅ Funcionando |
| Autorização por número | ✅ Apenas +553291473412 |
| Mensagens de texto | ✅ Análise com IA |
| Imagens | ✅ OCR + análise |
| Áudios | ✅ Transcrição |
| PDFs | ✅ Extração de texto |
| Supabase | ✅ Salvamento automático |
| Categorias com IA | ✅ Classificação automática |
| Confirmações | ✅ Mensagem de retorno |

### 🔄 Fluxo Completo

```
1. Mensagem recebida no WhatsApp
   ↓
2. Baileys captura e parseia
   ↓
3. Verifica se é do número autorizado (+553291473412)
   ↓
4. Busca usuário no Supabase
   ↓
5. Analisa conteúdo com IA (Gemini/OpenAI)
   ↓
6. Extrai: valor, descrição, data, categoria
   ↓
7. Busca banco padrão do usuário
   ↓
8. Classifica categoria com IA
   ↓
9. Cria lançamento no Supabase
   ↓
10. Envia confirmação via WhatsApp
```

## 🔧 Configuração

### Variáveis de Ambiente (.env)

```env
# Supabase
SUPABASE_URL=sua_url_aqui
SUPABASE_SERVICE_ROLE=sua_key_aqui

# IA (pelo menos uma)
GEMINI_API_KEY=sua_key_aqui
OPENAI_API_KEY=sua_key_aqui  # Opcional

# Servidor
PORT=3002
```

### Número Autorizado

Para mudar o número autorizado, edite no `index.js`:

```javascript
const ALLOWED_WHATSAPP = "+553291473412"; // <<< SEU NÚMERO AQUI
```

**Importante**: Use o formato E.164 completo com `+` e código do país.

## 📝 Exemplos de Uso

### Mensagem de Texto
```
"Paguei R$ 150,00 de conta de luz hoje"
```

Bot responde:
```
✅ Lançamento criado!
• Tipo: despesa
• Descrição: Conta de luz
• Valor: R$ 150.00
• Data competência: 2025-10-21
• Categoria: Energia
• Banco: Banco Principal (Principal)
ID: 123
```

### Imagem (Nota Fiscal)

Envie uma foto de nota fiscal ou comprovante.

Bot analisa a imagem e extrai:
- Valor
- Data
- Descrição
- Categoria sugerida

### Áudio

Grave um áudio:
```
"Recebi mil reais de freelance ontem"
```

Bot transcreve e processa automaticamente.

### PDF

Envie PDF de fatura, boleto ou comprovante.

Bot extrai o texto e processa.

## 🛠️ Scripts Disponíveis

```bash
# Bot principal com Baileys
node index.js

# Ou use o npm
npm run dev

# Teste simples do Baileys
npm run test-baileys

# Bot com Baileys (completo)
npm run baileys
```

## 🔍 Logs Detalhados

O bot mostra logs completos de cada etapa:

```
📱 [HANDLER] De: +553291473412, Tipo: text
✅ [AUTH] Número autorizado
✅ [DATABASE] Usuário encontrado: ID 1, Nome: Eduardo
🤖 [AI] Iniciando análise com IA - Tipo: text
📝 [AI] Analisando texto: "Paguei 100 reais de mercado"
✅ [AI] Análise concluída
🔧 [PROCESS] Normalizando dados extraídos
✅ [PROCESS] Dados normalizados
🏦 [DATABASE] Buscando banco padrão do usuário...
📂 [DATABASE] Buscando todas as categorias do tipo: despesa
🤖 [AI-CATEGORY] Solicitando à IA para escolher melhor categoria...
💾 [DATABASE] Criando lançamento...
✅ [DATABASE] Lançamento criado com ID: 456
📤 [SEND] Enviando confirmação
✅ [SEND] Confirmação enviada com sucesso!
🎉 [HANDLER] Processamento concluído com sucesso!
```

## 🚨 Segurança

### ✅ Implementado

1. **Autorização por número**: Apenas +553291473412 pode usar
2. **Verificação de usuário**: Precisa estar cadastrado no Supabase
3. **Banco obrigatório**: Usuário precisa ter banco configurado
4. **Credenciais protegidas**: `.env` no `.gitignore`
5. **Sessão local**: `baileys_auth/` não vai para o Git

### 📁 Arquivos Protegidos

```
baileys_auth/     # Sessão do WhatsApp (NUNCA commitar!)
.env              # Credenciais (NUNCA commitar!)
```

Ambos estão no `.gitignore`.

## ⚠️ Problemas Comuns

### Bot desconecta sozinho

**Causa**: Só pode ter 1 conexão WhatsApp Web ativa.

**Solução**: Feche WhatsApp Web no navegador.

### "Usuário não encontrado"

**Causa**: Número não cadastrado no Supabase.

**Solução**: Cadastre o usuário na tabela `users` com `phone_e164 = +553291473412`.

### "Nenhum banco configurado"

**Causa**: Usuário sem banco no sistema.

**Solução**: Cadastre um banco para o usuário na tabela `bancos`.

### Erro de IA (503)

**Causa**: Gemini/OpenAI sobrecarregados.

**Solução**: Bot automaticamente tenta fallback e avisa o usuário.

## 📊 Monitoramento

### Verificar se está rodando

```bash
curl http://localhost:3002
```

Resposta esperada:
```
ConectFin bot com Baileys!
```

### Ver logs em tempo real

Os logs aparecem automaticamente no terminal onde você rodou `node index.js`.

## 🔄 Restart Automático (Produção)

Use PM2 para manter o bot rodando:

```bash
# Instalar PM2
npm install -g pm2

# Iniciar bot
pm2 start index.js --name conectfin-bot

# Ver logs
pm2 logs conectfin-bot

# Reiniciar
pm2 restart conectfin-bot

# Parar
pm2 stop conectfin-bot
```

## 📚 Arquitetura

```
index.js
├── Importa baileys-client.js
├── Configura Express (porta 3002)
├── Define funções de IA (Gemini/OpenAI)
├── Define funções Supabase
├── Handler handleWhatsAppMessage()
│   ├── Parseia mensagem (Baileys)
│   ├── Verifica autorização
│   ├── Busca usuário
│   ├── Analisa com IA
│   ├── Normaliza dados
│   ├── Busca banco e categoria
│   ├── Cria lançamento
│   └── Envia confirmação
└── startBot()
    ├── Inicia Express
    ├── Conecta Baileys
    └── Registra handler
```

## 🎯 Próximos Passos

- [ ] Adicionar comandos (/saldo, /extrato, etc)
- [ ] Permitir múltiplos números autorizados
- [ ] Dashboard web para monitoramento
- [ ] Notificações de vencimentos
- [ ] Relatórios mensais automáticos

## 💡 Dicas

1. **Mantenha o terminal aberto** enquanto o bot estiver rodando
2. **Use PM2 em produção** para restart automático
3. **Monitore os logs** para debug
4. **Faça backup** da pasta `baileys_auth/`

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs no terminal
2. Confirme que o WhatsApp está conectado
3. Verifique se o número está autorizado
4. Confirme as credenciais no `.env`
5. Teste com mensagens simples primeiro

---

**🎉 Bot 100% funcional e integrado!**

Criado em: 21 de outubro de 2025
Versão: 1.0.0 (Baileys)
