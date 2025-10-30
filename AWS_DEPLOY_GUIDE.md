# 🚀 Guia Completo: Deploy na AWS com Webhook HTTPS

## 📋 Visão Geral

Este guia mostra como subir seu bot para a AWS com webhook HTTPS funcionando.

### Opções de Deploy:

1. **EC2 + Nginx + Let's Encrypt** (Recomendado - mais controle)
2. **Elastic Beanstalk** (Mais simples, abstrai infraestrutura)
3. **Lambda + API Gateway** (Serverless, mais barato para baixo volume)

Vamos focar na **Opção 1** que é a mais comum e flexível.

---

## 🎯 Opção 1: EC2 + Nginx + Let's Encrypt (RECOMENDADO)

### Vantagens:
- ✅ Controle total
- ✅ HTTPS gratuito (Let's Encrypt)
- ✅ Fácil de manter
- ✅ PM2 já configurado

### Custos Estimados:
- **EC2 t3.micro**: ~$8-10/mês (suficiente para o bot)
- **Domínio**: ~$10-15/ano (se não tiver)
- **Let's Encrypt**: GRÁTIS

---

## 📝 Passo a Passo Completo

### 1️⃣ Preparar Domínio

Você precisa de um domínio. Opções:

**Opção A: Comprar domínio**
- Namecheap: ~$10/ano (.com)
- GoDaddy: ~$12/ano
- Registro.br: ~R$40/ano (.com.br)

**Opção B: Usar subdomínio gratuito**
- No-IP: Grátis (http://seubot.ddns.net)
- DuckDNS: Grátis (https://seubot.duckdns.org)
- Freenom: Grátis (.tk, .ml, .ga)

**Para este guia, vamos assumir que você tem: `bot.conectfin.com.br`**

---

### 2️⃣ Criar EC2 na AWS

#### A. Acessar AWS Console
1. Acesse: https://console.aws.amazon.com/ec2/
2. Clique em **"Launch Instance"**

#### B. Configurações da Instância

| Config | Valor |
|--------|-------|
| **Nome** | conectfin-bot |
| **AMI** | Ubuntu Server 22.04 LTS |
| **Tipo** | t3.micro (ou t2.micro se free tier) |
| **Key Pair** | Criar novo ou usar existente |
| **Security Group** | Configurar abaixo ⬇️ |

#### C. Security Group (Firewall)

Adicione estas regras:

| Tipo | Protocolo | Porta | Origem | Descrição |
|------|-----------|-------|--------|-----------|
| SSH | TCP | 22 | My IP | Acesso SSH |
| HTTP | TCP | 80 | 0.0.0.0/0 | HTTP público |
| HTTPS | TCP | 443 | 0.0.0.0/0 | HTTPS público |
| Custom | TCP | 3000 | 0.0.0.0/0 | Bot (temporário) |

#### D. Configuração de Armazenamento
- 10 GB (suficiente)
- gp3 (mais rápido)

#### E. Lançar Instância
- Clique em **"Launch Instance"**
- Anote o **IP Público** (ex: 54.123.45.67)

---

### 3️⃣ Configurar DNS

No seu provedor de domínio (Registro.br, Namecheap, etc):

1. Vá em **DNS Settings** ou **Gerenciar Zona**
2. Adicione um registro **A**:

```
Tipo: A
Nome: bot (ou webhook)
Valor: 54.123.45.67 (IP da sua EC2)
TTL: 300 (5 minutos)
```

Resultado: `bot.conectfin.com.br` → IP da EC2

**Aguarde 5-10 minutos** para propagar.

Teste:
```bash
ping bot.conectfin.com.br
```

---

### 4️⃣ Conectar na EC2 e Configurar

#### A. Conectar via SSH

```bash
# Ajustar permissões da chave
chmod 400 sua-chave.pem

# Conectar
ssh -i sua-chave.pem ubuntu@54.123.45.67
# ou
ssh -i sua-chave.pem ubuntu@bot.conectfin.com.br
```

#### B. Atualizar Sistema

```bash
sudo apt update && sudo apt upgrade -y
```

#### C. Instalar Node.js

```bash
# Instalar NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Instalar Node.js 20
nvm install 20
nvm use 20
node --version  # Deve mostrar v20.x.x
```

#### D. Instalar PM2

```bash
npm install -g pm2
```

#### E. Instalar Nginx

```bash
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

#### F. Instalar Certbot (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx -y
```

---

### 5️⃣ Configurar o Bot

#### A. Clonar Repositório

```bash
cd ~
git clone git@github.com:eduardossimas/conectfin-whatsapp-bot.git conectfin-bot
cd conectfin-bot
```

Se não tiver SSH configurado, use HTTPS:
```bash
git clone https://github.com/eduardossimas/conectfin-whatsapp-bot.git conectfin-bot
```

#### B. Instalar Dependências

```bash
npm install
```

#### C. Configurar .env

```bash
nano .env
```

Cole suas configurações (do .env local):

```bash
WHATSAPP_MODE=waba
WABA_PROVIDER=meta
WABA_ACCESS_TOKEN=seu_token
WABA_PHONE_NUMBER_ID=seu_id
WABA_WEBHOOK_VERIFY_TOKEN=conectfin_webhook_secret_2025
WABA_WEBHOOK_URL=https://bot.conectfin.com.br/webhook/whatsapp
MEDIA_STORAGE=supabase
# ... resto das configs
```

**⚠️ IMPORTANTE**: Use `https://bot.conectfin.com.br` (seu domínio real)

Salvar: `Ctrl+X` → `Y` → `Enter`

#### D. Testar Bot Manualmente

```bash
npm run unified
```

Aguarde ver:
```
✅ ASSISTENTE INICIADO COM SUCESSO!
```

Se funcionou, pare com `Ctrl+C`.

---

### 6️⃣ Configurar Nginx como Proxy Reverso

#### A. Criar Configuração do Nginx

```bash
sudo nano /etc/nginx/sites-available/conectfin-bot
```

Cole esta configuração:

```nginx
server {
    listen 80;
    server_name bot.conectfin.com.br;  # SEU DOMÍNIO AQUI

    # Logs
    access_log /var/log/nginx/conectfin-bot-access.log;
    error_log /var/log/nginx/conectfin-bot-error.log;

    # Proxy para o bot
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Salvar: `Ctrl+X` → `Y` → `Enter`

#### B. Ativar Configuração

```bash
# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/conectfin-bot /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx
```

#### C. Testar HTTP

Abra no navegador: `http://bot.conectfin.com.br`

Deve aparecer:
```json
{
  "status": "online",
  "service": "ConectFin WhatsApp Bot",
  ...
}
```

---

### 7️⃣ Configurar HTTPS (Let's Encrypt)

```bash
# Obter certificado SSL
sudo certbot --nginx -d bot.conectfin.com.br

# Responda as perguntas:
# Email: seu@email.com
# Aceitar termos: Y
# Compartilhar email: N (opcional)
# Redirect HTTP → HTTPS: 2 (sim)
```

O Certbot vai:
- ✅ Gerar certificado SSL gratuito
- ✅ Configurar Nginx automaticamente
- ✅ Redirecionar HTTP → HTTPS

#### Testar HTTPS

Abra: `https://bot.conectfin.com.br`

Deve mostrar **cadeado verde** 🔒 e o JSON do bot.

---

### 8️⃣ Iniciar Bot com PM2

```bash
cd ~/conectfin-bot

# Iniciar bot
pm2 start ecosystem.config.cjs

# Ver status
pm2 status

# Configurar inicialização automática
pm2 startup
# Copie e execute o comando que aparecer (começa com sudo)

# Salvar configuração
pm2 save
```

Agora o bot:
- ✅ Roda 24/7
- ✅ Reinicia automaticamente em caso de crash
- ✅ Inicia ao reiniciar o servidor

---

### 9️⃣ Configurar Webhook no Meta

1. Acesse: https://developers.facebook.com/apps/
2. Vá no seu app → WhatsApp → Configuração
3. Em **Webhooks**, clique em **Editar**
4. Preencha:
   - **URL de callback**: `https://bot.conectfin.com.br/webhook/whatsapp`
   - **Verificar token**: `conectfin_webhook_secret_2025`
5. Clique em **"Verificar e salvar"**

Deve aparecer ✅ verde!

---

### 🔟 Testar Webhook

Envie uma mensagem para o número do WhatsApp Business.

Na EC2, veja os logs:
```bash
pm2 logs conectfin-bot
```

Deve aparecer:
```
📨 [WEBHOOK] Mensagem recebida!
📱 [WABA] De: +5532...
```

---

## 🔄 Deploy Automático (Opcional)

Para facilitar deploys futuros:

### No seu computador local:

1. Configure o IP no `ecosystem.config.cjs`:
```javascript
deploy: {
  production: {
    user: 'ubuntu',
    host: ['bot.conectfin.com.br'], // Seu domínio ou IP
    ...
  }
}
```

2. Configure SSH:
```bash
# Adicionar chave ao ssh-agent
ssh-add sua-chave.pem

# Testar conexão
ssh ubuntu@bot.conectfin.com.br
```

3. Deploy:
```bash
# Primeira vez (setup)
pm2 deploy ecosystem.config.cjs production setup

# Deploy
pm2 deploy ecosystem.config.cjs production
```

---

## 📊 Monitoramento

### Ver logs em tempo real:
```bash
pm2 logs conectfin-bot
```

### Ver status:
```bash
pm2 status
```

### Ver uso de recursos:
```bash
pm2 monit
```

### Logs do Nginx:
```bash
# Acesso
sudo tail -f /var/log/nginx/conectfin-bot-access.log

# Erros
sudo tail -f /var/log/nginx/conectfin-bot-error.log
```

---

## 🆘 Troubleshooting

### Webhook não verifica

**Problema**: "Webhook verification failed"

**Soluções**:
1. Verificar se bot está rodando: `pm2 status`
2. Verificar se Nginx está rodando: `sudo systemctl status nginx`
3. Testar URL manualmente: `curl https://bot.conectfin.com.br/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=conectfin_webhook_secret_2025&hub.challenge=teste`
   - Deve retornar: `teste`
4. Ver logs: `pm2 logs conectfin-bot`

### SSL não funciona

**Problema**: "NET::ERR_CERT_AUTHORITY_INVALID"

**Soluções**:
1. Verificar se certbot rodou: `sudo certbot certificates`
2. Renovar certificado: `sudo certbot renew --dry-run`
3. Ver logs: `sudo tail /var/log/letsencrypt/letsencrypt.log`

### Bot não inicia

**Problema**: PM2 mostra "errored"

**Soluções**:
1. Ver erro: `pm2 logs conectfin-bot --err`
2. Verificar .env: `cat .env`
3. Testar manualmente: `npm run unified`

---

## 💡 Dicas de Produção

### 1. Backup do .env
```bash
# Na EC2
cp .env .env.backup
```

### 2. Renovação automática do SSL
O Certbot já configura cron job automático, mas teste:
```bash
sudo certbot renew --dry-run
```

### 3. Monitoramento de espaço
```bash
df -h
```

### 4. Atualizar código
```bash
cd ~/conectfin-bot
git pull
npm install
pm2 restart conectfin-bot
```

### 5. Firewall adicional (UFW)
```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

---

## 💰 Custos Mensais Estimados

| Item | Custo |
|------|-------|
| EC2 t3.micro | $8-10 |
| Elastic IP (se usar) | $3-4 |
| Domínio | ~$1/mês |
| **Total** | **~$12-15/mês** |

**Supabase Storage**: 1GB grátis (suficiente)
**Let's Encrypt**: Grátis sempre

---

## ✅ Checklist Final

- [ ] Domínio configurado
- [ ] EC2 criada e rodando
- [ ] DNS apontando para EC2
- [ ] Node.js instalado
- [ ] PM2 instalado
- [ ] Bot clonado e .env configurado
- [ ] Nginx instalado e configurado
- [ ] SSL (Let's Encrypt) configurado
- [ ] Bot iniciado com PM2
- [ ] PM2 configurado para iniciar no boot
- [ ] Webhook verificado no Meta
- [ ] Teste: enviar mensagem e receber resposta

---

🎉 **Pronto! Seu bot está rodando em produção na AWS com HTTPS!**
