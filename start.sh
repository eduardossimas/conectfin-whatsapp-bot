#!/bin/bash

# ==================================
# Script de Teste do Baileys
# ==================================

echo "🧪 ConectFin Bot - Teste Baileys"
echo "=================================="
echo ""

# Verifica se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado!"
    echo "Instale: https://nodejs.org"
    exit 1
fi

echo "✅ Node.js: $(node --version)"
echo ""

# Verifica se as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
    echo ""
fi

# Pergunta qual script executar
echo "Escolha uma opção:"
echo ""
echo "1) 🧪 Teste simples (test-baileys.js)"
echo "2) 🤖 Bot completo (index-baileys.js)"
echo "3) 🔄 WAHA original (index.js)"
echo ""
read -p "Opção (1-3): " option

case $option in
    1)
        echo ""
        echo "🧪 Iniciando teste simples..."
        echo "👉 Escaneie o QR Code que aparecerá"
        echo ""
        node test-baileys.js
        ;;
    2)
        echo ""
        echo "🤖 Iniciando bot completo..."
        echo "👉 Escaneie o QR Code que aparecerá"
        echo ""
        node index-baileys.js
        ;;
    3)
        echo ""
        echo "🔄 Iniciando WAHA (webhook)..."
        echo ""
        node index.js
        ;;
    *)
        echo ""
        echo "❌ Opção inválida!"
        exit 1
        ;;
esac
