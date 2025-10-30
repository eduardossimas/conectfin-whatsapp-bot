# 🚀 Guia PM2 - ConectFin Bot

## 📋 O que é PM2?

PM2 é um gerenciador de processos para Node.js que mantém seu bot rodando 24/7 com:
- ✅ Auto-restart em caso de crash
- ✅ Logs organizados
- ✅ Monitoramento de recursos
- ✅ Inicialização automática (boot)
- ✅ Deploy simplificado

---

## 🎯 Comandos Principais

### Iniciar o Bot
```bash
npm run pm2:start
# ou diretamente
pm2 start ecosystem.config.js
```

### Ver Status
```bash
npm run pm2:status
# ou
pm2 status
```

Você verá:
```
┌─────┬──────────────────┬─────────┬─────────┬──────────┬────────┐
│ id  │ name             │ mode    │ ↺      │ status   │ cpu    │
├─────┼──────────────────┼─────────┼─────────┼──────────┼────────┤
│ 0   │ conectfin-bot    │ fork    │ 0      │ online   │ 0%     │
└─────┴──────────────────┴─────────┴─────────┴──────────┴────────┘
```

### Ver Logs em Tempo Real
```bash
npm run pm2:logs
# ou
pm2 logs conectfin-bot
```

Para sair dos logs: `Ctrl+C`

### Monitoramento Interativo
```bash
npm run pm2:monit
# ou
pm2 monit
```

Mostra CPU, memória, logs em tempo real. Para sair: `q`

### Reiniciar o Bot
```bash
npm run pm2:restart
# ou
pm2 restart conectfin-bot
```

### Parar o Bot
```bash
npm run pm2:stop
# ou
pm2 stop conectfin-bot
```

### Deletar do PM2
```bash
npm run pm2:delete
# ou
pm2 delete conectfin-bot
```

---

## 🔄 Configuração de Inicialização Automática

Para o bot iniciar automaticamente quando o servidor reiniciar:

### 1. Gerar script de startup
```bash
pm2 startup
```

Isso vai mostrar um comando. **Copie e execute** esse comando (geralmente começa com `sudo`).

### 2. Iniciar o bot
```bash
npm run pm2:start
```

### 3. Salvar configuração
```bash
npm run pm2:save
```

Pronto! Agora o bot vai iniciar automaticamente sempre que o servidor reiniciar.

---

## 📊 Logs

Os logs são salvos em:
```
logs/
├── error.log      → Apenas erros
├── out.log        → Output normal
└── combined.log   → Tudo junto
```

### Ver logs específicos
```bash
# Últimas 100 linhas
pm2 logs conectfin-bot --lines 100

# Apenas erros
pm2 logs conectfin-bot --err

# Apenas output
pm2 logs conectfin-bot --out

# Limpar logs antigos
pm2 flush
```

---

## 🔧 Configurações Avançadas

### Alterar limite de memória
Edite `ecosystem.config.js`:
```javascript
max_memory_restart: '500M', // Reinicia se passar de 500MB
```

### Restart automático diário
Descomente no `ecosystem.config.js`:
```javascript
cron_restart: '0 3 * * *', // Todo dia às 3h
```

### Watch mode (recarrega ao editar)
Para desenvolvimento:
```javascript
watch: true,
```

---

## 🌐 Deploy para AWS (quando subir)

### 1. Configurar credenciais SSH
No seu computador local:
```bash
# Copiar chave SSH para EC2
ssh-copy-id ubuntu@SEU_IP_AWS
```

### 2. Configurar deploy
Edite `ecosystem.config.js` e substitua:
```javascript
host: ['SEU_IP_AWS'], // Seu IP da EC2
```

### 3. Setup inicial (primeira vez)
```bash
pm2 deploy ecosystem.config.js production setup
```

### 4. Deploy
```bash
pm2 deploy ecosystem.config.js production
```

Isso vai:
- Fazer git pull
- npm install
- Reiniciar o bot

---

## 🆘 Troubleshooting

### Bot não inicia
```bash
# Ver erros
pm2 logs conectfin-bot --err

# Tentar iniciar manualmente para ver erro
node index-unified.js
```

### Bot reiniciando constantemente
```bash
# Ver quantos restarts
pm2 status

# Ver logs de erro
pm2 logs conectfin-bot --err --lines 50
```

Possíveis causas:
- Erro no código
- Falta de credenciais no .env
- Porta já em uso

### Memória alta
```bash
# Ver uso de memória
pm2 monit

# Diminuir limite
# Edite ecosystem.config.js:
max_memory_restart: '300M',
```

### Limpar logs antigos
```bash
pm2 flush
```

### Resetar PM2 completamente
```bash
pm2 kill
pm2 start ecosystem.config.js
```

---

## 📈 Monitoramento Web (Opcional)

PM2 oferece um dashboard web gratuito:

```bash
pm2 link [secret-key] [public-key]
```

Acesse: https://app.pm2.io/

Você terá:
- Monitoramento em tempo real
- Alertas de crash
- Histórico de recursos
- Deploy remoto

---

## 💡 Dicas

### 1. Sempre salve após alterar
```bash
pm2 save
```

### 2. Use logs para debug
```bash
pm2 logs conectfin-bot --lines 200
```

### 3. Monitore recursos
```bash
pm2 monit
```

### 4. Reinicie após atualizar código
```bash
git pull
npm install
pm2 restart conectfin-bot
```

### 5. Para deploy rápido
```bash
git push origin main
pm2 deploy ecosystem.config.js production
```

---

## 🎯 Resumo dos Comandos Essenciais

```bash
# Iniciar
npm run pm2:start

# Status
npm run pm2:status

# Logs
npm run pm2:logs

# Reiniciar
npm run pm2:restart

# Parar
npm run pm2:stop

# Monitorar
npm run pm2:monit

# Salvar configuração
npm run pm2:save
```

---

## 🚀 Para AWS (quando subir)

1. Configure `ecosystem.config.js` com IP da EC2
2. Na EC2, instale PM2: `sudo npm install -g pm2`
3. Configure startup: `pm2 startup`
4. Inicie: `pm2 start ecosystem.config.js`
5. Salve: `pm2 save`

Pronto! Bot rodando 24/7 na AWS! 🎉

---

**Documentação oficial**: https://pm2.keymetrics.io/docs/usage/quick-start/
