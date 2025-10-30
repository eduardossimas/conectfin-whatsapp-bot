#!/bin/bash

# Script para iniciar o bot com ngrok
# Facilita o desenvolvimento e testes com WABA

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║     🚀 Iniciando ConectFin Bot + ngrok                 ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Verifica se ngrok está instalado
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok não encontrado!"
    echo ""
    echo "Instale com:"
    echo "  brew install ngrok"
    echo ""
    exit 1
fi

# Verifica se PM2 está rodando
if pm2 status | grep -q "conectfin-bot"; then
    echo "⚠️  Bot já está rodando com PM2"
    echo ""
    read -p "Deseja parar e iniciar manualmente? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        pm2 stop conectfin-bot
        echo "✅ Bot parado"
    else
        echo "Mantendo PM2 rodando..."
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 INSTRUÇÕES:"
echo ""
echo "1️⃣  Vou iniciar o bot e o ngrok"
echo "2️⃣  Copie a URL do ngrok (https://xxxxx.ngrok-free.app)"
echo "3️⃣  Configure no Meta:"
echo "    URL: https://xxxxx.ngrok-free.app/webhook/whatsapp"
echo "    Token: conectfin_webhook_secret_2025"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Pressione ENTER para continuar..."
echo ""

# Cria pasta para logs do script
mkdir -p logs

# Inicia o bot em background
echo "🚀 [1/2] Iniciando o bot..."
npm run unified > logs/bot-startup.log 2>&1 &
BOT_PID=$!
echo "✅ Bot iniciado (PID: $BOT_PID)"
echo ""

# Aguarda 5 segundos para o bot iniciar
echo "⏳ Aguardando bot inicializar..."
sleep 5
echo ""

# Verifica se o bot está rodando
if ! ps -p $BOT_PID > /dev/null; then
    echo "❌ Erro ao iniciar o bot!"
    echo "Veja os logs em: logs/bot-startup.log"
    exit 1
fi

# Inicia o ngrok
echo "🌐 [2/2] Iniciando ngrok..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "║                                                            ║"
echo "║  🔗 COPIE A URL ABAIXO (começa com https://)             ║"
echo "║                                                            ║"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 URL para configurar no Meta:"
echo "   https://[copie-url-abaixo].ngrok-free.app/webhook/whatsapp"
echo ""
echo "🔐 Token de verificação:"
echo "   conectfin_webhook_secret_2025"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  IMPORTANTE: Esta URL expira quando você fechar o terminal!"
echo "Para produção, suba para AWS."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Inicia ngrok
ngrok http 3000

# Quando ngrok fechar, mata o bot
echo ""
echo "👋 Encerrando..."
kill $BOT_PID 2>/dev/null
echo "✅ Bot encerrado"
