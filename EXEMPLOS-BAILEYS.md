# 📚 Exemplos de Uso - Baileys

## 🎯 Exemplo 1: Enviar Mensagem Simples

```javascript
import BaileysClient from './baileys-client.js';

// Conectar
await BaileysClient.start();

// Enviar mensagem
await BaileysClient.sendText(
  '+5532991473412', 
  'Olá! Esta é uma mensagem de teste.'
);
```

## 📨 Exemplo 2: Receber e Responder Mensagens

```javascript
import BaileysClient from './baileys-client.js';

await BaileysClient.start();

BaileysClient.onMessage(async (message) => {
  const parsed = await BaileysClient.parseMessage(message);
  
  console.log('Mensagem de:', parsed.from);
  console.log('Texto:', parsed.text);
  
  // Responder
  await BaileysClient.sendText(
    parsed.from,
    `Recebi: ${parsed.text}`
  );
});
```

## 🖼️ Exemplo 3: Processar Imagem

```javascript
BaileysClient.onMessage(async (message) => {
  const parsed = await BaileysClient.parseMessage(message);
  
  if (parsed.type === 'image' && parsed.media) {
    console.log('📷 Imagem recebida!');
    console.log('Tamanho:', parsed.media.buffer.length);
    console.log('Tipo:', parsed.media.mimetype);
    console.log('Legenda:', parsed.caption);
    
    // Salvar imagem
    const fs = require('fs');
    fs.writeFileSync('imagem.jpg', parsed.media.buffer);
    
    await BaileysClient.sendText(
      parsed.from,
      '✅ Imagem recebida e salva!'
    );
  }
});
```

## 🎵 Exemplo 4: Processar Áudio

```javascript
BaileysClient.onMessage(async (message) => {
  const parsed = await BaileysClient.parseMessage(message);
  
  if (parsed.type === 'audio' && parsed.media) {
    console.log('🎵 Áudio recebido!');
    
    // Converter para base64 para enviar para API de transcrição
    const base64Audio = parsed.media.base64;
    
    // Aqui você pode enviar para Gemini, OpenAI, etc
    // const transcricao = await transcribeAudio(base64Audio);
    
    await BaileysClient.sendText(
      parsed.from,
      '✅ Áudio recebido!'
    );
  }
});
```

## 📄 Exemplo 5: Processar PDF

```javascript
import pdfParse from 'pdf-parse';

BaileysClient.onMessage(async (message) => {
  const parsed = await BaileysClient.parseMessage(message);
  
  if (parsed.type === 'document' && parsed.media) {
    const mimetype = parsed.media.mimetype;
    
    if (mimetype === 'application/pdf') {
      console.log('📄 PDF recebido!');
      
      // Extrair texto do PDF
      const pdfData = await pdfParse(parsed.media.buffer);
      console.log('Texto extraído:', pdfData.text);
      
      await BaileysClient.sendText(
        parsed.from,
        `✅ PDF processado!\n\nPáginas: ${pdfData.numpages}\nCaracteres: ${pdfData.text.length}`
      );
    }
  }
});
```

## 🔍 Exemplo 6: Filtrar Mensagens por Número

```javascript
const NUMEROS_AUTORIZADOS = [
  '+5532991473412',
  '+5531987654321'
];

BaileysClient.onMessage(async (message) => {
  const parsed = await BaileysClient.parseMessage(message);
  
  if (!NUMEROS_AUTORIZADOS.includes(parsed.from)) {
    console.log('⛔ Número não autorizado:', parsed.from);
    return; // Ignora
  }
  
  console.log('✅ Número autorizado:', parsed.from);
  
  // Processar mensagem...
});
```

## 🤖 Exemplo 7: Bot com Comandos

```javascript
BaileysClient.onMessage(async (message) => {
  const parsed = await BaileysClient.parseMessage(message);
  
  const text = parsed.text.toLowerCase();
  
  if (text === '/help') {
    await BaileysClient.sendText(
      parsed.from,
      '📋 Comandos disponíveis:\n\n' +
      '/help - Ajuda\n' +
      '/status - Status do bot\n' +
      '/ping - Testar conexão'
    );
  }
  else if (text === '/status') {
    await BaileysClient.sendText(
      parsed.from,
      '✅ Bot online e funcionando!'
    );
  }
  else if (text === '/ping') {
    await BaileysClient.sendText(
      parsed.from,
      '🏓 Pong!'
    );
  }
  else {
    // Mensagem normal
    console.log('Mensagem:', text);
  }
});
```

## 💾 Exemplo 8: Integração com Supabase

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

BaileysClient.onMessage(async (message) => {
  const parsed = await BaileysClient.parseMessage(message);
  
  // Buscar usuário no banco
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('phone_e164', parsed.from)
    .single();
  
  if (!user) {
    await BaileysClient.sendText(
      parsed.from,
      '❌ Usuário não cadastrado!'
    );
    return;
  }
  
  console.log('✅ Usuário encontrado:', user.nome);
  
  // Processar mensagem do usuário...
});
```

## 🔄 Exemplo 9: Processamento Assíncrono

```javascript
BaileysClient.onMessage(async (message) => {
  const parsed = await BaileysClient.parseMessage(message);
  
  // Enviar confirmação imediata
  await BaileysClient.sendText(
    parsed.from,
    '⏳ Processando sua mensagem...'
  );
  
  try {
    // Processar (pode demorar)
    await sleep(3000); // Simula processamento
    const resultado = await processarAlgo(parsed.text);
    
    // Enviar resultado
    await BaileysClient.sendText(
      parsed.from,
      `✅ Pronto!\n\nResultado: ${resultado}`
    );
  } catch (error) {
    await BaileysClient.sendText(
      parsed.from,
      '❌ Erro ao processar. Tente novamente.'
    );
  }
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## 🎨 Exemplo 10: Mensagens Formatadas

```javascript
BaileysClient.onMessage(async (message) => {
  const parsed = await BaileysClient.parseMessage(message);
  
  const resposta = [
    '🎉 *Bem-vindo ao ConectFin!*',
    '',
    '📊 Suas estatísticas:',
    '• Lançamentos: _123_',
    '• Categorias: _15_',
    '• Saldo: *R$ 5.432,10*',
    '',
    '💡 _Digite /help para ver comandos_'
  ].join('\n');
  
  await BaileysClient.sendText(parsed.from, resposta);
});
```

## 🛡️ Exemplo 11: Tratamento de Erros

```javascript
BaileysClient.onMessage(async (message) => {
  try {
    const parsed = await BaileysClient.parseMessage(message);
    
    // Processar mensagem
    const resultado = await processarMensagem(parsed);
    
    await BaileysClient.sendText(
      parsed.from,
      `✅ ${resultado}`
    );
    
  } catch (error) {
    console.error('Erro:', error);
    
    const { from } = await BaileysClient.parseMessage(message);
    
    await BaileysClient.sendText(
      from,
      '❌ Desculpe, ocorreu um erro.\n\nTente novamente mais tarde.'
    );
  }
});
```

## ⏱️ Exemplo 12: Mensagens Agendadas

```javascript
// Agendar mensagem para daqui 1 hora
function agendarMensagem(para, texto, delayMs) {
  setTimeout(async () => {
    await BaileysClient.sendText(para, texto);
    console.log('📤 Mensagem agendada enviada!');
  }, delayMs);
}

// Usar
const UMA_HORA = 60 * 60 * 1000;
agendarMensagem(
  '+5532991473412',
  '⏰ Lembrete: Reunião em 15 minutos!',
  UMA_HORA
);
```

## 📊 Exemplo 13: Análise com IA (Gemini)

```javascript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

BaileysClient.onMessage(async (message) => {
  const parsed = await BaileysClient.parseMessage(message);
  
  if (parsed.type === 'image' && parsed.media) {
    // Analisar imagem com Gemini Vision
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp' 
    });
    
    const result = await model.generateContent([
      'O que você vê nesta imagem?',
      {
        inlineData: {
          data: parsed.media.base64,
          mimeType: parsed.media.mimetype
        }
      }
    ]);
    
    const analise = result.response.text();
    
    await BaileysClient.sendText(
      parsed.from,
      `🤖 Análise da imagem:\n\n${analise}`
    );
  }
});
```

## 🎯 Exemplo 14: Sistema de Filas

```javascript
const filaProcessamento = [];
let processando = false;

BaileysClient.onMessage(async (message) => {
  const parsed = await BaileysClient.parseMessage(message);
  
  // Adicionar à fila
  filaProcessamento.push(parsed);
  
  await BaileysClient.sendText(
    parsed.from,
    `⏳ Sua mensagem está na posição ${filaProcessamento.length} da fila`
  );
  
  // Processar fila
  if (!processando) {
    processarFila();
  }
});

async function processarFila() {
  processando = true;
  
  while (filaProcessamento.length > 0) {
    const item = filaProcessamento.shift();
    
    try {
      // Processar
      await processarItem(item);
      
      await BaileysClient.sendText(
        item.from,
        '✅ Processamento concluído!'
      );
    } catch (error) {
      console.error('Erro:', error);
    }
  }
  
  processando = false;
}
```

## 💡 Dicas Importantes

1. **Sempre use try-catch** em handlers de mensagens
2. **Valide os dados** antes de processar
3. **Use await** em todas as operações assíncronas
4. **Teste com mensagens simples** antes de implementar lógica complexa
5. **Monitore os logs** para debug

---

**🚀 Com esses exemplos você já pode criar seu bot completo!**
