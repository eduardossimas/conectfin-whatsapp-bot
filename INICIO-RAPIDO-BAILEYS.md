# 🚀 Início Rápido - Baileys

## ⚡ 3 Passos para Começar

### 1️⃣ Configure seu número
Edite o arquivo que vai usar e configure seu número:

```javascript
const ALLOWED_WHATSAPP = "+5532991473412"; // <<< SEU NÚMERO AQUI
```

### 2️⃣ Execute o teste
```bash
npm run test-baileys
```

### 3️⃣ Escaneie o QR Code
1. Um QR Code aparecerá no terminal
2. Abra WhatsApp no celular
3. Vá em **Dispositivos conectados**
4. Escaneie o código

## 🎯 Pronto!

Quando ver esta mensagem, está funcionando:
```
✅ [BAILEYS] Conectado ao WhatsApp!
📱 [BAILEYS] Número: 5532XXXXXXXXX
```

## 📝 Scripts Disponíveis

```bash
# Teste simples (recomendado para começar)
npm run test-baileys

# Bot completo com Baileys
npm run baileys

# Bot original com WAHA (webhook)
npm run waha
```

## 🔥 Comandos Úteis

### Testar conexão
```bash
node test-baileys.js
```

### Rodar bot completo
```bash
node index-baileys.js
```

### Limpar sessão (reconectar)
```bash
rm -rf baileys_auth/
node test-baileys.js
```

## 📱 Como Usar

1. **Envie uma mensagem** para o número conectado
2. **O bot responde automaticamente** confirmando o recebimento
3. **Veja os logs** no terminal com todos os detalhes

## 🎨 Tipos de Mensagem Suportados

- ✅ Texto simples
- ✅ Imagens (com legenda)
- ✅ Áudios
- ✅ Documentos (PDF, etc)
- ✅ Vídeos

## 🐛 Problemas Comuns

### QR Code não aparece?
- Maximize a janela do terminal
- Use um terminal que suporte caracteres especiais

### Desconecta sozinho?
- Só pode ter **uma conexão WhatsApp Web** ativa por vez
- Feche WhatsApp Web no navegador se estiver aberto

### Erro ao enviar mensagem?
- Aguarde a mensagem "✅ Conectado ao WhatsApp!"
- O número precisa estar no formato: `+5532991473412`

## 📚 Documentação Completa

Para mais detalhes, veja:
- [GUIA-BAILEYS.md](./GUIA-BAILEYS.md) - Guia completo
- [CONFIGURAR.md](./CONFIGURAR.md) - Configuração geral

## 🆘 Ajuda

Tem dúvidas? Verifique:
1. Logs no terminal
2. Se o WhatsApp está conectado
3. Se o número está correto
4. Se as variáveis de ambiente (.env) estão configuradas

---

**🎉 Boa sorte com seu bot!**
