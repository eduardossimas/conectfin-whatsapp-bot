# ❓ FAQ - Perguntas Frequentes sobre WABA

## 🤔 Perguntas Gerais

### P: Preciso migrar agora?
**R:** Não! Seu bot atual com Baileys continua funcionando perfeitamente. Migre quando:
- Precisar de mais estabilidade
- Quiser suporte oficial
- Tiver mais de 1000 conversas/mês e quiser garantias
- Precisar de múltiplos números

### P: Posso usar ambos ao mesmo tempo?
**R:** Não simultaneamente no mesmo número, mas você pode:
- Usar Baileys em desenvolvimento e WABA em produção
- Ter instâncias separadas com números diferentes
- Alternar entre modos mudando `WHATSAPP_MODE` no `.env`

### P: Qual provedor WABA escolher?
**R:** Recomendamos nesta ordem:
1. **Meta Cloud API** - Grátis até 1000 conversas/mês, oficial
2. **Twilio** - Setup mais simples, suporte excelente, mas mais caro
3. **360Dialog** - Bom para Europa, preço fixo mensal

### P: Quanto custa WABA?
**R:**
- **Meta Cloud API**: GRÁTIS até 1000 conversas/mês, depois ~$0.02-0.04/conversa
- **Twilio**: ~$0.005/mensagem (enviada e recebida)
- **360Dialog**: A partir de €49/mês (ilimitado)

---

## 🔧 Perguntas Técnicas

### P: O que é uma "conversa" no Meta Cloud API?
**R:** Uma conversa é uma janela de 24 horas com um cliente. Se você responde dentro de 24h, conta como 1 conversa. Se responder depois, inicia nova conversa (cobra novamente).

### P: Preciso de um servidor com IP fixo?
**R:** Não necessariamente, mas você precisa de:
- Uma URL pública acessível (pode ser domínio dinâmico)
- HTTPS (pode usar Cloudflare, Nginx com Let's Encrypt, etc)
- Para desenvolvimento local: use **ngrok** (cria túnel temporário)

### P: Como funciona o webhook?
**R:**
```
WhatsApp → Provedor WABA → POST para sua URL → Seu servidor processa → Responde
```

Você configura uma URL (ex: `https://seu-dominio.com/webhook/whatsapp`) no painel do provedor. Quando alguém envia mensagem, o provedor faz um POST para essa URL com os dados da mensagem.

### P: Preciso migrar meu código?
**R:** Quase nada! Os handlers permanecem os mesmos. Mudanças automáticas:
- `whatsapp-service-unified.js` detecta o modo automaticamente
- Para imagens, o serviço faz upload automático se WABA
- Você só precisa configurar credenciais no `.env`

### P: E se eu não tiver domínio próprio?
**R:** Para desenvolvimento:
- Use **ngrok**: `ngrok http 3000` (cria URL temporária gratuita)
- Use **localtunnel**: `lt --port 3000`

Para produção:
- Hospede em servidor com domínio (DigitalOcean, AWS, Heroku, etc)
- Use serviço gratuito: Render.com, Railway.app, Fly.io

---

## 📸 Perguntas sobre Mídia

### P: Por que WABA precisa de URL pública para imagens?
**R:** A API oficial do WhatsApp não aceita envio direto de Buffers como o Baileys. Você precisa:
1. Hospedar a imagem em algum lugar público
2. Enviar a URL para a API
3. A API baixa e envia ao destinatário

### P: Qual serviço de armazenamento usar?
**R:** Depende do seu setup atual:
- **Já usa Supabase?** → Use Supabase Storage (mais fácil)
- **Já usa AWS?** → Use S3
- **Quer simplicidade?** → Use Cloudinary (grátis até 25GB)
- **Só testar?** → Use local + ngrok

### P: Como configurar Supabase Storage?
**R:**
1. No dashboard Supabase, vá em **Storage**
2. Clique em **New bucket**
3. Nome: `whatsapp-media`
4. Public: **✅ ON**
5. No `.env`: `MEDIA_STORAGE=supabase`

Pronto! O serviço usa suas credenciais Supabase já configuradas.

### P: Imagens grandes demoram muito?
**R:** Dica: redimensione antes de enviar. Exemplo:
```javascript
// No chart-service-svg.js, você pode reduzir resolução:
const canvas = createCanvas(400, 300);  // Menor = mais rápido
```

---

## 🚨 Problemas Comuns

### P: "Webhook verification failed"
**R:** Verifique:
- [ ] URL está acessível publicamente (teste com `curl`)
- [ ] `WABA_WEBHOOK_VERIFY_TOKEN` no `.env` é igual ao configurado no provedor
- [ ] Servidor está rodando na porta correta
- [ ] Não há firewall bloqueando

**Testar:**
```bash
curl "http://localhost:3000/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=teste"
# Deve retornar: teste
```

### P: "Invalid access token"
**R:** Você está usando o token de teste (expira em 24h). Você precisa gerar um **token permanente**:

**Meta Cloud API:**
1. Dashboard → Configurações → Configurações básicas
2. Role até "Token de acesso do sistema"
3. Clique em "Gerar token"
4. Escolha validade: **60 dias** ou **Nunca expira**
5. Copie e cole no `.env`

### P: Webhook não recebe mensagens
**R:** Checklist:
- [ ] Webhook está **verificado** no dashboard do provedor? (deve ter ✅ verde)
- [ ] Campos corretos marcados? (para Meta: marque `messages`)
- [ ] URL tem HTTPS? (Meta exige HTTPS em produção)
- [ ] Logs mostram requisição chegando? (olhe terminal do seu servidor)

**Debug:**
```bash
# No seu servidor, adicione log no início do webhook:
app.post("/webhook/whatsapp", async (req, res) => {
  console.log('🔔 WEBHOOK RECEBIDO:', JSON.stringify(req.body, null, 2));
  // ...resto do código
});
```

### P: Erro 401 ao enviar mensagem
**R:** Token inválido ou expirado. Regenere o token permanente.

### P: Erro 403 ao enviar mensagem
**R:** Possíveis causas:
- Número não está verificado no WhatsApp Business
- Template não aprovado (se usando template)
- Limite de mensagens atingido
- Conta suspensa

Verifique o dashboard do provedor para detalhes.

---

## 💰 Perguntas sobre Custos

### P: Meta Cloud API é realmente grátis?
**R:** Sim! Grátis para:
- Até **1000 conversas por mês**
- Conversas iniciadas pelo cliente (ilimitadas dentro da janela de 24h)
- Conversas iniciadas por você usando templates aprovados (grátis até 1000/mês)

Depois de 1000 conversas, você paga ~$0.02-0.04 por conversa.

### P: Como é cobrado?
**R:**
- **Meta**: Por conversa (janela de 24h)
- **Twilio**: Por mensagem (cada mensagem enviada/recebida)
- **360Dialog**: Plano fixo mensal (ilimitado)

### P: Vale a pena pagar?
**R:** Depende:
- **< 1000 conversas/mês**: Meta é grátis, use!
- **Poucos usuários, uso leve**: Baileys grátis é suficiente
- **Muitos usuários, produção crítica**: WABA compensa pela estabilidade
- **Precisa suporte**: WABA obrigatório

---

## 🔐 Perguntas sobre Segurança

### P: É seguro expor webhook publicamente?
**R:** Sim, com as precauções:
- ✅ Use token de verificação forte (aleatório, 32+ caracteres)
- ✅ Valide o token em cada requisição
- ✅ Use HTTPS em produção
- ✅ Rate limiting (limite requisições por IP)
- ✅ Valide estrutura da mensagem antes de processar

O código já implementa validação de token.

### P: Como proteger minhas credenciais?
**R:**
- ✅ NUNCA commite o arquivo `.env` (já no `.gitignore`)
- ✅ Use variáveis de ambiente no servidor de produção
- ✅ Rotacione tokens periodicamente
- ✅ Use tokens com permissões mínimas necessárias

### P: Posso ser hackeado via webhook?
**R:** Improvável se você:
- Valida o token de verificação (já implementado)
- Valida estrutura das mensagens (já implementado)
- Não executa código não sanitizado das mensagens
- Mantém dependências atualizadas

---

## 🎓 Perguntas sobre Migração

### P: Quanto tempo leva a migração?
**R:**
- **Setup inicial**: 30-60 minutos
- **Aprovação Meta** (se necessário): 1-3 dias úteis
- **Testes**: 1-2 horas
- **Total**: ~1 dia de trabalho distribuído em 3-5 dias

### P: Perco mensagens durante a migração?
**R:** Não! Estratégias:
1. **Teste em paralelo**: Configure WABA em número diferente primeiro
2. **Migração gradual**: Mantenha Baileys rodando enquanto testa WABA
3. **Horário de baixo uso**: Troque em horário que tem poucas mensagens

### P: Posso voltar para Baileys depois?
**R:** Sim! É só mudar no `.env`:
```bash
WHATSAPP_MODE=baileys
```
E reiniciar o servidor. Seus códigos de Baileys não foram alterados.

### P: Preciso avisar os usuários?
**R:** Depende:
- **Mesmo número**: Não, é transparente para eles
- **Número diferente**: Sim, avise que mudou o número do bot

---

## 📚 Onde Aprender Mais?

- **Meta Cloud API**: https://developers.facebook.com/docs/whatsapp/cloud-api
- **Twilio**: https://www.twilio.com/docs/whatsapp
- **360Dialog**: https://docs.360dialog.com/
- **Ngrok**: https://ngrok.com/docs

---

## 🆘 Ainda com Dúvidas?

1. **Leia o guia completo**: `cat MIGRATION_GUIDE.md`
2. **Veja exemplos de configuração**: `cat .env.example`
3. **Use o setup interativo**: `npm run setup`
4. **Veja os logs**: O servidor tem logs muito detalhados
5. **Teste incrementalmente**: Vá passo a passo

---

**💡 Dica Final**: Comece com Baileys, teste tudo, depois migre para WABA quando estiver confortável. Não há pressa! 🚀
