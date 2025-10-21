# 🚀 Guia de Configuração - Baileys WhatsApp Bot

Este guia explica como configurar e usar o Baileys para conectar seu bot do ConectFin ao WhatsApp.

## 📋 O que é Baileys?

Baileys é uma biblioteca JavaScript que permite conectar ao WhatsApp Web sem precisar de servidores externos como WAHA. Ele se conecta diretamente usando o protocolo do WhatsApp Web.

**Vantagens:**
- ✅ Totalmente gratuito
- ✅ Não precisa de servidor externo
- ✅ Mais controle sobre a conexão
- ✅ Suporte a todos os tipos de mídia
- ✅ Autenticação local (mais seguro)

## 🔧 Instalação

As dependências já foram instaladas automaticamente:

```bash
npm install @whiskeysockets/baileys qrcode-terminal pino
```

## 📱 Como Conectar o WhatsApp

### Passo 1: Configure seu número autorizado

Edite o arquivo `index-baileys.js` (ou crie uma cópia do `index.js`) e configure seu número:

```javascript
const ALLOWED_WHATSAPP = "+5532XXXXXXXXX"; // Seu número aqui
```

### Passo 2: Inicie o bot

```bash
node index-baileys.js
```

### Passo 3: Escaneie o QR Code

1. Um QR Code será exibido no terminal
2. Abra o WhatsApp no seu celular
3. Vá em **Configurações** > **Dispositivos conectados**
4. Toque em **Conectar dispositivo**
5. Escaneie o QR Code que apareceu no terminal

### Passo 4: Aguarde a confirmação

Quando conectar com sucesso, você verá:

```
✅ [BAILEYS] Conectado ao WhatsApp!
📱 [BAILEYS] Número: 5532XXXXXXXXX@s.whatsapp.net
📝 [BAILEYS] Nome: Seu Nome
```

## 🗂️ Estrutura de Arquivos

Após conectar, será criada uma pasta `baileys_auth/` com os dados de autenticação:

```
conectfin-bot/
├── baileys_auth/          # ⚠️ NÃO COMPARTILHE esta pasta!
│   ├── creds.json         # Credenciais de autenticação
│   └── ...                # Outros arquivos de sessão
├── baileys-client.js      # Cliente Baileys (pronto)
├── index-baileys.js       # Exemplo de uso com Baileys
└── index.js               # Versão original com WAHA
```

### ⚠️ IMPORTANTE: Segurança

A pasta `baileys_auth/` contém suas credenciais de WhatsApp. **NUNCA** compartilhe ou envie para o Git!

Adicione ao `.gitignore`:

```
baileys_auth/
```

## 🔄 Migração do WAHA para Baileys

### Comparação de Código

**WAHA (antes):**
```javascript
// Precisava de servidor externo rodando
if (process.env.WAHA_URL) {
  await axios.post(process.env.WAHA_URL, { 
    session: 'default',
    chatId, 
    text 
  });
}
```

**Baileys (agora):**
```javascript
// Conexão direta, sem servidor externo
import BaileysClient from './baileys-client.js';

// Enviar mensagem
await BaileysClient.sendText('+5532XXXXXXXXX', 'Olá!');

// Receber mensagens
BaileysClient.onMessage(async (message) => {
  const parsed = await BaileysClient.parseMessage(message);
  console.log('Mensagem recebida:', parsed);
});
```

## 📝 Uso Básico

### 1. Enviar Mensagem de Texto

```javascript
await BaileysClient.sendText('+5532991473412', 'Olá! Teste do bot.');
```

### 2. Receber Mensagens

```javascript
BaileysClient.onMessage(async (message) => {
  // Parsear mensagem
  const { from, type, text, media } = await BaileysClient.parseMessage(message);
  
  console.log(`De: ${from}`);
  console.log(`Tipo: ${type}`); // text, image, audio, document
  console.log(`Texto: ${text}`);
  
  // Se for mídia
  if (media) {
    console.log(`Mídia: ${media.buffer.length} bytes`);
    console.log(`Tipo: ${media.mimetype}`);
  }
});
```

### 3. Processar Diferentes Tipos de Mensagem

```javascript
const parsed = await BaileysClient.parseMessage(message);

switch (parsed.type) {
  case 'text':
    console.log('Mensagem de texto:', parsed.text);
    break;
    
  case 'image':
    console.log('Imagem recebida');
    console.log('Caption:', parsed.caption);
    console.log('Buffer:', parsed.media.buffer);
    break;
    
  case 'audio':
    console.log('Áudio recebido');
    console.log('Buffer:', parsed.media.buffer);
    break;
    
  case 'document':
    console.log('Documento recebido');
    console.log('Tipo:', parsed.media.mimetype);
    break;
}
```

## 🛠️ API do baileys-client.js

### `startBaileys()`
Inicia a conexão com WhatsApp. Exibe QR Code no terminal.

```javascript
await BaileysClient.start();
```

### `onMessage(handler)`
Define a função que será chamada quando uma mensagem chegar.

```javascript
BaileysClient.onMessage(async (message) => {
  // Seu código aqui
});
```

### `sendText(to, text)`
Envia mensagem de texto.

```javascript
await BaileysClient.sendText('+5532991473412', 'Olá!');
```

### `parseMessage(message)`
Converte mensagem do Baileys para formato padronizado.

```javascript
const parsed = await BaileysClient.parseMessage(message);
// Retorna: { from, type, text, caption, media, timestamp }
```

### `stopBaileys()`
Desconecta do WhatsApp.

```javascript
await BaileysClient.stop();
```

### `getSocket()`
Retorna o socket do Baileys para uso avançado.

```javascript
const sock = BaileysClient.getSocket();
```

## 🔥 Integração Completa com ConectFin

Para integrar completamente, você pode:

### Opção 1: Substituir o index.js existente

1. Faça backup do `index.js` atual:
   ```bash
   cp index.js index-waha.js.backup
   ```

2. Substitua as funções de envio/recebimento por Baileys

3. Remova as dependências do WAHA

### Opção 2: Usar arquivo separado (recomendado)

Mantenha os dois arquivos:
- `index.js` - Versão com WAHA (webhook)
- `index-baileys.js` - Versão com Baileys (conexão direta)

Execute o que preferir:
```bash
# WAHA
node index.js

# Baileys
node index-baileys.js
```

## 🐛 Troubleshooting

### QR Code não aparece
- Verifique se o terminal suporta caracteres especiais
- Tente aumentar o tamanho da janela do terminal

### Erro "WhatsApp não conectado"
- Execute `startBaileys()` antes de enviar mensagens
- Aguarde a mensagem "✅ Conectado ao WhatsApp!"

### Desconexão frequente
- Verifique sua conexão com a internet
- O WhatsApp só permite uma conexão Web por vez
- Certifique-se de não estar usando WhatsApp Web no navegador

### "Erro ao baixar mídia"
- Verifique se a mensagem realmente contém mídia
- Algumas mídias podem expirar após um tempo

## 📊 Comparação: WAHA vs Baileys

| Recurso | WAHA | Baileys |
|---------|------|---------|
| Instalação | Servidor externo | Biblioteca local |
| Custo | Gratuito/Pago | Totalmente gratuito |
| Configuração | Docker/API | QR Code direto |
| Dependências | Servidor rodando | Apenas Node.js |
| Controle | Limitado pela API | Total sobre conexão |
| Tipos de mídia | Todos | Todos |
| Webhook | Sim | Não (usa eventos) |
| Performance | Depende do servidor | Local (mais rápido) |

## 🎯 Próximos Passos

1. ✅ Conectar WhatsApp escaneando QR Code
2. ✅ Testar envio de mensagem
3. ✅ Testar recebimento de mensagens
4. ⬜ Integrar com sistema de categorias
5. ⬜ Adicionar logs detalhados
6. ⬜ Configurar restart automático
7. ⬜ Deploy em servidor

## 💡 Dicas

- **Mantenha o bot rodando**: Use PM2 ou similar para manter o processo ativo
- **Backup das credenciais**: Faça backup da pasta `baileys_auth/` periodicamente
- **Reconexão automática**: O código já tem reconexão automática implementada
- **Múltiplos números**: Para usar múltiplos números, crie pastas de auth separadas

## 📚 Documentação Adicional

- [Baileys GitHub](https://github.com/WhiskeySockets/Baileys)
- [Exemplos oficiais](https://github.com/WhiskeySockets/Baileys/tree/master/Example)

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs no terminal
2. Certifique-se de que o WhatsApp está conectado
3. Teste com mensagens simples primeiro
4. Verifique as variáveis de ambiente (.env)

---

**Criado para ConectFin Bot** 🚀
