// index.js
import "dotenv/config";
import express from "express";
import morgan from "morgan";
import axios from "axios";
import dayjs from "dayjs";
import { createRequire } from "module";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Importar Baileys
import BaileysClient from './baileys-client.js';

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

// Helper para obter __dirname em ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json({ limit: "25mb" }));
app.use(morgan("dev"));

// ======================= CONFIG INICIAL =======================
const PORT = Number(process.env.PORT || 3000);

// Número autorizado para testes (formato E.164 completo)
const ALLOWED_WHATSAPP = "+553291473412"; // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

// Supabase, OpenAI & Gemini
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

// Inicializar OpenAI (se disponível)
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Inicializar Gemini como fallback
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ========================= WHATSAPP OUT (BAILEYS) ========================
async function sendWhatsAppText({ to, text }) {
  try {
    console.log(`📤 [SEND] Enviando via Baileys para ${to}: ${text.substring(0, 50)}...`);
    await BaileysClient.sendText(to, text);
    console.log(`✅ [SEND] Mensagem enviada com sucesso`);
  } catch (error) {
    console.error('❌ [SEND] Erro ao enviar mensagem via Baileys:', error.message);
    
    // Fallback para WAHA se configurado
    if (process.env.WAHA_URL) {
      try {
        const phoneNumber = to.replace("+", "");
        const chatId = phoneNumber.includes('@c.us') ? phoneNumber : `${phoneNumber}@c.us`;
        
        console.log(`🔄 [SEND] Tentando WAHA como fallback...`);
        await axios.post(process.env.WAHA_URL, { 
          session: 'default',
          chatId, 
          text 
        }, {
          timeout: 10000
        });
        console.log(`✅ [SEND] Mensagem enviada via WAHA (fallback)`);
        return;
      } catch (wahaError) {
        console.error("❌ [SEND] WAHA fallback também falhou:", wahaError.message);
      }
    }
    
    // Fallback para WhatsApp Cloud API se configurado
    const isValidCloudConfig = 
      process.env.WA_CLOUD_PHONE_ID && 
      process.env.WA_CLOUD_TOKEN &&
      !process.env.WA_CLOUD_PHONE_ID.includes('seu_phone_id') &&
      !process.env.WA_CLOUD_TOKEN.includes('seu_token');

    if (isValidCloudConfig) {
      try {
        console.log(`🔄 [SEND] Tentando WhatsApp Cloud API como fallback...`);
        const url = `https://graph.facebook.com/v20.0/${process.env.WA_CLOUD_PHONE_ID}/messages`;
        await axios.post(
          url,
          {
            messaging_product: "whatsapp",
            to,
            text: { body: text },
          },
          {
            headers: { Authorization: `Bearer ${process.env.WA_CLOUD_TOKEN}` },
          }
        );
        console.log(`✅ [SEND] Mensagem enviada via Cloud API (fallback)`);
        return;
      } catch (cloudError) {
        console.error("❌ [SEND] Cloud API fallback também falhou:", cloudError.message);
      }
    }
    
    throw new Error('Falha ao enviar mensagem por todos os métodos disponíveis');
  }
}

// ========================= WAHA INBOUND ========================
function normalizePhoneE164(raw = "") {
  // Remove sufixo "@c.us" e tudo que não é dígito
  let digits = String(raw).replace("@c.us", "").replace(/\D/g, "");
  
  // Garante que tenha o formato E.164 com + no início
  if (digits && !digits.startsWith("+")) {
    digits = "+" + digits;
  }
  
  return digits;
}

function detectTypeFromWAHA(payload) {
  // Para WAHA, verificamos se há mídia ou se é texto
  const msg = payload?.message || {};
  
  console.log(`🔍 [DEBUG] detectTypeFromWAHA - hasMedia: ${msg.hasMedia}`);
  console.log(`🔍 [DEBUG] msg._data?.Message keys:`, Object.keys(msg._data?.Message || {}));
  
  if (msg.hasMedia) {
    // Se tem mídia, verificamos o tipo pela estrutura da mensagem
    if (msg._data?.Message?.audioMessage || msg._data?.Message?.pttMessage) {
      console.log(`🎵 [DEBUG] Detectado como audio`);
      return "audio";
    }
    if (msg._data?.Message?.imageMessage) {
      console.log(`🖼️ [DEBUG] Detectado como image`);
      return "image";
    }
    if (msg._data?.Message?.documentMessage) {
      console.log(`📄 [DEBUG] Detectado como document`);
      return "document";
    }
    
    // Fallback: se tem mídia mas não conseguiu detectar o tipo específico
    console.log(`❓ [DEBUG] Mídia detectada mas tipo desconhecido, assumindo document`);
    return "document";
  }
  
  // Se não tem mídia ou não conseguiu detectar, é texto
  console.log(`📝 [DEBUG] Detectado como text`);
  return "text";
}

// data:<mime>;base64,<b64>  ->  Buffer + mime
function parseDataUrl(dataUrl = "") {
  if (!dataUrl || typeof dataUrl !== 'string') {
    console.log(`❌ [DEBUG] parseDataUrl: entrada inválida - ${typeof dataUrl}`);
    return null;
  }
  
  console.log(`🔍 [DEBUG] parseDataUrl: analisando ${dataUrl.length} caracteres`);
  console.log(`🔍 [DEBUG] parseDataUrl: início - ${dataUrl.substring(0, 50)}...`);
  
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/);
  if (!m) {
    console.log(`❌ [DEBUG] parseDataUrl: não matchou padrão data:mime;base64,`);
    
    // Tenta outros padrões comuns
    if (dataUrl.startsWith('http')) {
      console.log(`🔗 [DEBUG] parseDataUrl: parece ser URL HTTP, não data URL`);
      return null;
    }
    
    // Se é apenas base64 sem prefixo
    if (/^[A-Za-z0-9+/=]+$/.test(dataUrl)) {
      console.log(`📝 [DEBUG] parseDataUrl: parece ser base64 puro, assumindo application/octet-stream`);
      return { buffer: Buffer.from(dataUrl, "base64"), mime: "application/octet-stream" };
    }
    
    return null;
  }
  
  const mime = m[1];
  const b64 = m[2];
  
  console.log(`✅ [DEBUG] parseDataUrl: sucesso - mime: ${mime}, base64: ${b64.length} chars`);
  
  return { buffer: Buffer.from(b64, "base64"), mime };
}

// ============================ LLM ==============================
// Carregar prompts dos arquivos Markdown
const SYSTEM_PARSER = readFileSync(
  join(__dirname, "prompts", "system-parser.md"),
  "utf-8"
);

const SYSTEM_CATEGORY_CLASSIFIER = readFileSync(
  join(__dirname, "prompts", "system-category-classifier.md"),
  "utf-8"
);

const SYSTEM_DOCUMENT_ANALYZER = readFileSync(
  join(__dirname, "prompts", "system-document-analyzer.md"),
  "utf-8"
);

// Função para download de PDF (replica o step "Download PDF" do n8n)
async function downloadPdfFromUrl(url) {
  console.log(`🌐 [DOWNLOAD-PDF] Iniciando download de: ${url}`);
  
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'ConectFin-Bot/1.0'
      }
    });
    
    const buffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'application/pdf';
    
    console.log(`✅ [DOWNLOAD-PDF] Download concluído: ${buffer.length} bytes`);
    console.log(`📋 [DOWNLOAD-PDF] Content-Type: ${contentType}`);
    
    return { buffer, mime: contentType };
    
  } catch (error) {
    console.error(`❌ [DOWNLOAD-PDF] Erro no download:`, error.message);
    throw new Error(`Falha ao baixar PDF: ${error.message}`);
  }
}

async function analyzeDocumentContent(documentText) {
  console.log(`🔍 [DOC-ANALYZER] Iniciando análise de documento...`);
  
  const analysisPrompt = `O documento está em PT-BR. Faça uma análise do que está contido nele e dê um resumo levando em conta as informações serão inseridas em um sistema financeiro.

DOCUMENTO:
${documentText}

Identifique e resuma:
1. Tipo de documento
2. Valores encontrados
3. Datas relevantes
4. Descrição do produto/serviço
5. Se é receita ou despesa
6. Qualquer informação financeira relevante

Seja objetivo e foque em dados que podem virar lançamentos financeiros.`;

  try {
    const analysis = await runLLM(SYSTEM_DOCUMENT_ANALYZER, [
      { text: analysisPrompt }
    ]);
    
    console.log(`✅ [DOC-ANALYZER] Análise concluída: ${analysis.substring(0, 200)}...`);
    return analysis;
    
  } catch (error) {
    console.error(`❌ [DOC-ANALYZER] Erro na análise:`, error);
    return "Não foi possível analisar o documento automaticamente.";
  }
}

// Modelos disponíveis
const OPENAI_MODEL = "gpt-4o-mini"; // Econômico e eficiente
const GEMINI_PRIMARY = "gemini-2.0-flash-exp";
const GEMINI_FALLBACK = "gemini-1.5-flash";

/**
 * Função principal para executar LLM
 * Tenta OpenAI primeiro (se disponível), depois Gemini como fallback
 */
async function runLLM(system, userParts, retryCount = 0) {
  const maxRetries = 3;
  
  // Tentativa 1: OpenAI (se disponível)
  if (openai && retryCount === 0) {
    try {
      console.log(`🤖 [AI] Tentativa ${retryCount + 1}/${maxRetries + 1} - Provedor: OpenAI - Modelo: ${OPENAI_MODEL}`);
      
      // Converter userParts para formato OpenAI
      const messages = [
        { role: "system", content: system }
      ];
      
      // Processar userParts (pode ter texto ou inlineData)
      for (const part of userParts) {
        if (part.text) {
          messages.push({ role: "user", content: part.text });
        } else if (part.inlineData) {
          // OpenAI Vision API para imagens/documentos
          const mimeType = part.inlineData.mimeType || "image/jpeg";
          
          if (mimeType.startsWith("image/")) {
            messages.push({
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${part.inlineData.data}`
                  }
                }
              ]
            });
          } else if (mimeType.startsWith("audio/")) {
            // Para áudio, OpenAI usa Whisper separadamente
            // Por ora, vamos usar Gemini para áudio
            console.log(`⚠️ [AI] OpenAI não suporta áudio inline, usando Gemini...`);
            return runLLMGemini(system, userParts, 0);
          } else {
            // Para outros tipos, tenta como imagem
            messages.push({
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${part.inlineData.data}`
                  }
                }
              ]
            });
          }
        }
      }
      
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: messages,
        temperature: 0.1, // Mais determinístico para parsing
        max_tokens: 1000
      });
      
      const txt = response.choices[0].message.content.trim();
      console.log(`✅ [AI] Resposta obtida com sucesso usando OpenAI (${OPENAI_MODEL})`);
      console.log(`📊 [AI] Tokens usados: ${response.usage.total_tokens} (prompt: ${response.usage.prompt_tokens}, completion: ${response.usage.completion_tokens})`);
      
      // remove cercas ```json
      return txt.replace(/```json|```/g, "").trim();
      
    } catch (error) {
      console.error(`❌ [AI] Erro com OpenAI:`, error.message);
      
      // Se erro de rate limit ou servidor, tenta Gemini
      if (error.status === 429 || error.status >= 500) {
        console.log(`🔄 [AI] OpenAI indisponível, tentando Gemini...`);
        return runLLMGemini(system, userParts, 0);
      }
      
      // Para outros erros da OpenAI, tenta Gemini
      console.log(`🔄 [AI] Erro na OpenAI, tentando Gemini como fallback...`);
      return runLLMGemini(system, userParts, 0);
    }
  }
  
  // Se OpenAI não disponível ou falhou, usa Gemini
  return runLLMGemini(system, userParts, retryCount);
}

/**
 * Função específica para Gemini (fallback)
 */
async function runLLMGemini(system, userParts, retryCount = 0) {
  const maxRetries = 2;
  const modelToUse = retryCount === 0 ? GEMINI_PRIMARY : GEMINI_FALLBACK;
  
  console.log(`🤖 [AI] Tentativa Gemini ${retryCount + 1}/${maxRetries + 1} - Modelo: ${modelToUse}`);
  
  try {
    const model = genAI.getGenerativeModel({
      model: modelToUse,
      systemInstruction: system,
    });
    
    const res = await model.generateContent({
      contents: [{ role: "user", parts: userParts }],
    });
    
    const txt = res.response.text().trim();
    console.log(`✅ [AI] Resposta obtida com sucesso usando Gemini (${modelToUse})`);
    
    // remove cercas ```json
    return txt.replace(/```json|```/g, "").trim();
    
  } catch (error) {
    console.error(`❌ [AI] Erro com Gemini (${modelToUse}):`, error.message);
    
    // Se é erro 503 (overloaded) e ainda há tentativas
    if (error.message.includes('503') && retryCount < maxRetries) {
      console.log(`🔄 [AI] Tentando novamente com modelo Gemini fallback...`);
      await sleep(1000);
      return runLLMGemini(system, userParts, retryCount + 1);
    }
    
    // Se é erro 503 mas já esgotou tentativas
    if (error.message.includes('503')) {
      throw new Error('Serviço de IA temporariamente indisponível. Tente novamente em alguns minutos.');
    }
    
    // Para outros erros, relança
    throw error;
  }
}

// ====================== ANALISADORES (INLINE) ==================
async function analyzeInlineAudio({ buffer, mime }) {
  const today = dayjs().format("YYYY-MM-DD");
  const base64 = buffer.toString("base64");
  const jsonStr = await runLLM(SYSTEM_PARSER, [
    { inlineData: { data: base64, mimeType: mime || "audio/ogg" } },
    { text: `NOW_ISO="${today}"\nExtraia os campos do áudio acima.` },
  ]);
  return JSON.parse(jsonStr);
}

async function analyzeInlineImage({ buffer, mime, caption = "" }) {
  const today = dayjs().format("YYYY-MM-DD");
  const base64 = buffer.toString("base64");
  const jsonStr = await runLLM(SYSTEM_PARSER, [
    { inlineData: { data: base64, mimeType: mime || "image/jpeg" } },
    {
      text: `NOW_ISO="${today}"\nLegenda: ${
        caption || "(sem)"
      }\nA imagem pode ser nota fiscal, comprovante, fatura ou foto de quadro. Extraia os campos.`,
    },
  ]);
  return JSON.parse(jsonStr);
}

async function analyzeInlinePdf({ buffer }) {
  const today = dayjs().format("YYYY-MM-DD");
  
  try {
    // Step 1: Extract text from PDF (simula "Download PDF")
    console.log(`📄 [PDF] Extraindo texto do PDF...`);
    const { text } = await pdfParse(buffer);
    console.log(`📄 [PDF] Texto extraído: ${text.length} caracteres`);
    
    if (!text || text.trim().length === 0) {
      throw new Error("PDF não contém texto legível");
    }
    
    console.log(`📄 [PDF] Primeiros 200 chars: "${text.substring(0, 200)}..."`);
    
    // Step 2: Analyze document (seguindo o workflow exato)
    const documentAnalysis = await analyzeDocumentContent(text);
    
    // Step 3: Extract structured data (simula "Edit Fields5")
    console.log(`🔧 [PDF] Extraindo dados estruturados...`);
    
    const extractionPrompt = `NOW_ISO="${today}"

ANÁLISE DO DOCUMENTO:
${documentAnalysis}

TEXTO ORIGINAL:
${text.substring(0, 2000)}

Com base na análise acima, extraia os dados financeiros e retorne APENAS o JSON no formato especificado.`;

    const jsonStr = await runLLM(SYSTEM_PARSER, [
      { text: extractionPrompt },
    ]);
    
    console.log(`✅ [PDF] Análise completa concluída`);
    return JSON.parse(jsonStr);
    
  } catch (error) {
    console.error(`❌ [PDF] Erro ao processar PDF:`, error.message);
    
    // Fallback: retorna estrutura básica solicitando manual
    return {
      descricao: "Documento não processado",
      valor: null,
      tipo_lancamento: null,
      data_competencia: today,
      data_pagamento: null,
      data_vencimento: null,
      categoria_sugerida: null,
      needs_fix: true,
      missing: ["valor", "tipo_lancamento", "descricao"],
      confidence: 0.0,
      suggestions: ["Não foi possível processar o documento automaticamente. Por favor, digite as informações manualmente: 'Paguei R$ [valor] de [descrição] em [data]'"]
    };
  }
}

async function analyzeFreeText(text) {
  const today = dayjs().format("YYYY-MM-DD");
  const prompt = `NOW_ISO="${today}", text="${text}"`;
  
  const jsonStr = await runLLM(SYSTEM_PARSER, [{ text: prompt }]);
  return JSON.parse(jsonStr);
}

// ========================= SUPABASE ============================
async function getUserByPhone(whats) {
  // `whats` já vem só dígitos (ex: 5532991473412)
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("phone_e164", whats) // igualdade direta (coluna UNIQUE)
    .maybeSingle();

  if (error) throw error;
  return data; // { id, nome, ... }
}

async function getBancoIdPadrao(user_id) {
  if (!user_id) return null;

  console.log(`🏦 [DATABASE] Buscando banco padrão para usuário ${user_id}`);

  // 1. Primeiro tenta buscar o banco principal (is_principal = true)
  const { data: bancoPrincipal, error: errorPrincipal } = await supabase
    .from("bancos")
    .select("id, nome_banco, is_principal")
    .eq("user_id", user_id)
    .eq("is_principal", true)
    .limit(1);

  if (errorPrincipal) throw errorPrincipal;

  if (bancoPrincipal && bancoPrincipal.length > 0) {
    console.log(`✅ [DATABASE] Banco principal encontrado: ${bancoPrincipal[0].nome_banco} (ID: ${bancoPrincipal[0].id})`);
    return bancoPrincipal[0].id;
  }

  // 2. Se não houver banco principal, pega o último criado (fallback)
  console.log(`⚠️ [DATABASE] Nenhum banco principal definido, buscando último criado`);
  
  const { data: ultimoBanco, error: errorUltimo } = await supabase
    .from("bancos")
    .select("id, nome_banco")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (errorUltimo) throw errorUltimo;

  if (ultimoBanco && ultimoBanco.length > 0) {
    console.log(`✅ [DATABASE] Último banco encontrado: ${ultimoBanco[0].nome_banco} (ID: ${ultimoBanco[0].id})`);
    return ultimoBanco[0].id;
  }

  console.log(`❌ [DATABASE] Nenhum banco encontrado para o usuário`);
  return null;
}

async function getAllUserCategorias(user_id, tipo_lancamento) {
  if (!user_id) return [];

  const { data, error } = await supabase
    .from("categorias")
    .select("id, nome, tipo_lancamento")
    .eq("user_id", user_id)
    .eq("tipo_lancamento", tipo_lancamento || "despesa");

  if (error) throw error;
  return data || [];
}

async function findBestCategoriaWithAI(user_id, transactionData, allCategorias) {
  if (!allCategorias || allCategorias.length === 0) {
    console.log(`❌ [AI-CATEGORY] Nenhuma categoria disponível para o usuário`);
    return null;
  }

  // Se não há categoria sugerida, usa a primeira disponível
  if (!transactionData.categoria_sugerida) {
    console.log(`⚠️ [AI-CATEGORY] Sem categoria sugerida, usando primeira disponível: ${allCategorias[0]?.nome}`);
    return allCategorias[0]?.id || null;
  }

  // Monta lista de nomes das categorias para a IA
  const categoriasExistentes = allCategorias.map(cat => cat.nome);
  
  console.log(`🔍 [AI-CATEGORY] Categoria sugerida: "${transactionData.categoria_sugerida}"`);
  console.log(`📋 [AI-CATEGORY] Categorias disponíveis: ${categoriasExistentes.join(', ')}`);
  
  const aiPrompt = `categoria_sugerida: ${transactionData.categoria_sugerida}

categorias_existentes: ${categoriasExistentes.join(', ')}`;

  try {
    const response = await runLLM(SYSTEM_CATEGORY_CLASSIFIER, [
      { text: aiPrompt }
    ]);
    
    const nomeEscolhido = response.trim();
    console.log(`🤖 [AI-CATEGORY] IA escolheu: "${nomeEscolhido}"`);
    
    // Encontra a categoria pelo nome retornado
    const categoriaEncontrada = allCategorias.find(cat => 
      cat.nome.toLowerCase() === nomeEscolhido.toLowerCase()
    );
    
    if (categoriaEncontrada) {
      console.log(`✅ [AI-CATEGORY] Match encontrado: ID ${categoriaEncontrada.id} - "${categoriaEncontrada.nome}"`);
      return categoriaEncontrada.id;
    } else {
      console.log(`⚠️ [AI-CATEGORY] Nome "${nomeEscolhido}" não encontrado, usando primeira disponível: ${allCategorias[0]?.nome}`);
      return allCategorias[0]?.id; // fallback para primeira categoria
    }
    
  } catch (error) {
    console.error("❌ [AI-CATEGORY] Erro na IA para categoria:", error);
    return allCategorias[0]?.id || null; // fallback
  }
}

async function createLancamento({
  user_id, // não existe na tabela, mas podemos validar antes
  tipo, // 'receita' | 'despesa'
  descricao,
  valor,
  data_competencia, // string 'YYYY-MM-DD' obrigatória
  data_pagamento = null, // string 'YYYY-MM-DD' opcional
  data_vencimento = null, // string 'YYYY-MM-DD' opcional
  banco_id, // -> id_banco (NOT NULL)
  categoria_id, // -> id_categoria (pode ser null)
  origem = "whatsapp", // não tem coluna correspondente; ignore ou crie coluna depois
}) {
  if (!banco_id)
    throw new Error(
      "Nenhum banco encontrado para este usuário. Configure um banco no ConectFin primeiro."
    );
  if (!valor && valor !== 0)
    throw new Error("valor é obrigatório neste schema.");
  if (!descricao) throw new Error("descricao é obrigatória.");
  if (!data_competencia)
    throw new Error("data_competencia é obrigatória.");

  const rowToInsert = {
    descricao,
    valor,
    data_lancamento: data_competencia, // usa competência como lançamento por padrão
    tipo_lancamento: tipo,
    id_banco: banco_id,
    id_categoria: categoria_id || null,
    data_competencia,
    data_vencimento,
    data_pagamento,
  };

  const { data: row, error } = await supabase
    .from("lancamentos")
    .insert([rowToInsert])
    .select()
    .single();

  if (error) throw error;
  return row;
}

// ============================ WEB =============================
app.get("/", (_req, res) => res.send("ConectFin bot com Baileys!"));

// Endpoint para testar classificação de categorias
app.post("/test-category", async (req, res) => {
  try {
    const { user_id, categoria_sugerida, tipo_lancamento } = req.body;
    
    if (!user_id || !categoria_sugerida) {
      return res.status(400).json({ error: "user_id e categoria_sugerida são obrigatórios" });
    }
    
    // Buscar categorias do usuário
    const allCategorias = await getAllUserCategorias(user_id, tipo_lancamento || "despesa");
    
    // Simular dados da transação
    const transactionData = { categoria_sugerida };
    
    // Testar classificação
    const categoriaId = await findBestCategoriaWithAI(user_id, transactionData, allCategorias);
    const categoriaEscolhida = allCategorias.find(cat => cat.id === categoriaId);
    
    res.json({
      entrada: {
        categoria_sugerida,
        tipo_lancamento: tipo_lancamento || "despesa",
        categorias_disponiveis: allCategorias.map(c => ({ id: c.id, nome: c.nome }))
      },
      resultado: {
        categoria_id: categoriaId,
        categoria_nome: categoriaEscolhida?.nome,
        match_encontrado: !!categoriaEscolhida
      }
    });
    
  } catch (error) {
    console.error("Erro no teste de categoria:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========================= HANDLER BAILEYS =========================
async function handleWhatsAppMessage(message) {
  try {
    console.log('\n🔄 [HANDLER] Processando mensagem recebida...');
    
    // Parsear mensagem usando Baileys
    const parsed = await BaileysClient.parseMessage(message);
    const { from, type, text, caption, media } = parsed;
    
    console.log(`📱 [HANDLER] De: ${from}, Tipo: ${type}`);
    
    // ---------- Autorização por número ----------
    if (from !== ALLOWED_WHATSAPP) {
      console.log(`⚠️ [AUTH] Número não autorizado: ${from}. Ignorando mensagem.`);
      return;
    }

    console.log(`✅ [AUTH] Número autorizado: ${from}`);

    // ---------- Usuário no Supabase ----------
    console.log(`🔍 [DATABASE] Buscando usuário no Supabase: ${from}`);
    const user = await getUserByPhone(from);
    
    if (!user) {
      console.log(`❌ [DATABASE] Usuário não encontrado: ${from}`);
      await sendWhatsAppText({
        to: from,
        text: "Usuário não encontrado. Cadastre seu número no ConectFin.",
      });
      return;
    }

    console.log(`✅ [DATABASE] Usuário encontrado: ID ${user.id}, Nome: ${user.nome || 'N/A'}`);

    // ---------- Análise com IA ----------
    console.log(`🤖 [AI] Iniciando análise com IA - Tipo: ${type}`);
    
    let parsed_data;
    
    if (type === 'text') {
      console.log(`📝 [AI] Analisando texto: "${text}"`);
      parsed_data = await analyzeFreeText(text);
    } else if (type === 'image' && media) {
      console.log(`🖼️ [AI] Analisando imagem`);
      parsed_data = await analyzeInlineImage({
        buffer: media.buffer,
        mime: media.mimetype,
        caption: caption || text
      });
    } else if (type === 'audio' && media) {
      console.log(`🎵 [AI] Analisando áudio`);
      parsed_data = await analyzeInlineAudio({
        buffer: media.buffer,
        mime: media.mimetype
      });
    } else if (type === 'document' && media) {
      if (media.mimetype.includes('pdf')) {
        console.log(`📄 [AI] Analisando PDF`);
        parsed_data = await analyzeInlinePdf({ buffer: media.buffer });
      } else {
        console.log(`📄 [AI] Documento não-PDF, analisando como texto`);
        parsed_data = await analyzeFreeText(caption || text || "Documento enviado");
      }
    } else {
      console.log(`❌ [AI] Tipo de mensagem não suportado: ${type}`);
      await sendWhatsAppText({
        to: from,
        text: "❌ Tipo de mensagem não suportado. Envie texto, imagem, áudio ou PDF com informações do lançamento."
      });
      return;
    }

    console.log(`✅ [AI] Análise concluída:`, JSON.stringify(parsed_data, null, 2));

    // ---------- Normalização & defaults ----------
    console.log(`🔧 [PROCESS] Normalizando dados extraídos`);
    
    const today = dayjs().format("YYYY-MM-DD");
    const payloadOut = {
      tipo: parsed_data.tipo_lancamento || "despesa",
      descricao: parsed_data.descricao || (caption || text || "").slice(0, 140),
      valor: parsed_data.valor != null ? Number(parsed_data.valor) : null,
      data_competencia: parsed_data.data_competencia || today,
      data_pagamento: parsed_data.data_pagamento || null,
      data_vencimento: parsed_data.data_vencimento || null,
      categoria_sugerida: parsed_data.categoria_sugerida || null,
      needs_fix: parsed_data.needs_fix || false,
      confidence: parsed_data.confidence || 0.0,
    };

    console.log(`✅ [PROCESS] Dados normalizados:`, JSON.stringify(payloadOut, null, 2));

    // Verificar se precisa de correção
    if (payloadOut.needs_fix) {
      console.log(`⚠️ [PROCESS] Transação precisa de correção. Missing:`, parsed_data.missing);
      console.log(`💡 [PROCESS] Sugestões:`, parsed_data.suggestions);
      
      let errorMessage = `❌ Informações incompletas!\n\nFaltando: ${parsed_data.missing?.join(', ')}\n\nSugestão: ${parsed_data.suggestions?.join(' ')}\n\nTente novamente com mais detalhes.`;
      
      // Se foi um documento, adiciona contexto específico
      if (type === "document") {
        errorMessage = `📄 Documento processado, mas faltam informações:\n\n❌ Faltando: ${parsed_data.missing?.join(', ')}\n\n💡 ${parsed_data.suggestions?.join(' ')}\n\nVocê pode:\n• Reenviar um documento mais claro\n• Digitar as informações manualmente`;
      }
      
      await sendWhatsAppText({
        to: from,
        text: errorMessage
      });
      return;
    }

    // ---------- Buscar ids / gravação (seguindo workflow) ----------
    console.log(`🔍 [DATABASE] Iniciando workflow: User → Último Banco → Todas Categorias → IA`);
    
    // 1. Pegar banco padrão do usuário (principal ou último criado)
    console.log(`🏦 [DATABASE] Buscando banco padrão do usuário...`);
    const id_banco = await getBancoIdPadrao(user.id);
    console.log(`✅ [DATABASE] Banco padrão ID: ${id_banco}`);

    // Verificar se tem banco configurado
    if (!id_banco) {
      console.log(`❌ [DATABASE] Usuário sem banco configurado`);
      await sendWhatsAppText({
        to: from,
        text: "❌ Você ainda não tem nenhum banco configurado no ConectFin.\n\nPor favor:\n1. Acesse o sistema\n2. Cadastre pelo menos um banco\n3. Defina um como principal (opcional)\n\nApós isso, pode usar o WhatsApp normalmente! 🙂"
      });
      return;
    }

    // 2. Pegar todas as categorias do usuário para o tipo de transação
    console.log(`📂 [DATABASE] Buscando todas as categorias do tipo: ${payloadOut.tipo}`);
    const allCategorias = await getAllUserCategorias(user.id, payloadOut.tipo);
    console.log(`✅ [DATABASE] Encontradas ${allCategorias.length} categorias:`, 
      allCategorias.map(c => `${c.id}: ${c.nome}`).join(', '));

    // 3. IA escolhe a melhor categoria
    console.log(`🤖 [AI-CATEGORY] Solicitando à IA para escolher melhor categoria...`);
    const id_categoria = await findBestCategoriaWithAI(user.id, payloadOut, allCategorias);
    console.log(`✅ [AI-CATEGORY] IA escolheu categoria ID: ${id_categoria}`);

    console.log(`💾 [DATABASE] Criando lançamento...`);

    const lanc = await createLancamento({
      user_id: user.id,
      tipo: payloadOut.tipo,
      descricao: payloadOut.descricao,
      valor: payloadOut.valor,
      data_competencia: payloadOut.data_competencia,
      data_pagamento: payloadOut.data_pagamento,
      data_vencimento: payloadOut.data_vencimento,
      banco_id: id_banco,
      categoria_id: id_categoria,
    });

    console.log(`✅ [DATABASE] Lançamento criado com ID: ${lanc.id}`);

    // ---------- Confirmação ----------
    console.log(`📤 [SEND] Preparando mensagem de confirmação`);
    
    // Busca nome da categoria e banco para exibir
    const categoriaEscolhida = allCategorias.find(cat => cat.id === id_categoria);
    
    // Buscar nome do banco usado
    const { data: bancoUsado } = await supabase
      .from("bancos")
      .select("nome_banco, is_principal")
      .eq("id", id_banco)
      .single();
    
    const confirm = [
      `✅ Lançamento criado!`,
      `• Tipo: ${payloadOut.tipo}`,
      `• Descrição: ${payloadOut.descricao || "-"}`,
      `• Valor: ${
        payloadOut.valor !== null
          ? `R$ ${Number(payloadOut.valor).toFixed(2)}`
          : "(sem valor)"
      }`,
      `• Data competência: ${payloadOut.data_competencia}`,
      payloadOut.data_pagamento ? `• Data pagamento: ${payloadOut.data_pagamento}` : null,
      payloadOut.data_vencimento ? `• Data vencimento: ${payloadOut.data_vencimento}` : null,
      `• Categoria: ${categoriaEscolhida?.nome || `#${id_categoria}`}`,
      `• Banco: ${bancoUsado?.nome_banco || "N/A"}${bancoUsado?.is_principal ? " (Principal)" : ""}`,
      `ID: ${lanc.id}`,
    ].filter(Boolean).join("\n");

    console.log(`📤 [SEND] Enviando confirmação: "${confirm.substring(0, 100)}..."`);
    await sendWhatsAppText({ to: from, text: confirm });
    console.log(`✅ [SEND] Confirmação enviada com sucesso!`);
    console.log(`🎉 [HANDLER] Processamento concluído com sucesso!`);
    
  } catch (err) {
    console.error("💥 [ERROR] HANDLER ERROR:", err.message);
    console.error("💥 [ERROR] Stack trace:", err.stack);
    
    // Log mais detalhado do erro
    if (err.response) {
      console.error("💥 [ERROR] Response status:", err.response.status);
      console.error("💥 [ERROR] Response data:", err.response.data);
    }
    
    try {
      console.log(`📤 [ERROR] Tentando enviar mensagem de erro`);
      
      // Parsear mensagem para pegar o número (se ainda não temos)
      let from = ALLOWED_WHATSAPP;
      try {
        const parsed = await BaileysClient.parseMessage(message);
        from = parsed.from;
      } catch (parseErr) {
        console.error("❌ [ERROR] Erro ao parsear mensagem para erro:", parseErr.message);
      }
      
      if (from) {
        await sleep(250);
        let errorMessage = "❌ Não consegui processar sua mensagem agora. Pode tentar novamente?";
        
        // Mensagem específica para erros de configuração
        if (err.message && err.message.includes('401')) {
          errorMessage = "❌ Erro de configuração do WhatsApp. Entre em contato com o suporte.";
        }
        
        // Mensagem específica para IA indisponível
        if (err.message && (err.message.includes('503') || err.message.includes('overloaded') || err.message.includes('temporariamente indisponível'))) {
          errorMessage = "🤖 A IA está temporariamente sobrecarregada.\n\n⏱️ Tente novamente em alguns minutos.\n\nObrigado pela paciência! 😊";
        }
        
        console.log(`📤 [ERROR] Enviando mensagem de erro para ${from}`);
        await sendWhatsAppText({
          to: from,
          text: errorMessage,
        });
        console.log(`✅ [ERROR] Mensagem de erro enviada`);
      }
    } catch (sendErr) {
      console.error("💥 [ERROR] Erro ao enviar mensagem de erro:", sendErr.message);
    }
  }
}

// ========================== INICIALIZAÇÃO =============================
async function startBot() {
  console.log('\n🚀 [INICIO] Iniciando ConectFin Bot com Baileys...\n');
  
  // Iniciar servidor Express
  app.listen(PORT, () => {
    console.log(`✅ [SERVER] Servidor HTTP rodando na porta ${PORT}`);
    console.log(`🌐 [SERVER] http://localhost:${PORT}`);
  });
  
  // Iniciar Baileys
  console.log('\n📱 [BAILEYS] Conectando ao WhatsApp...');
  console.log('👉 [BAILEYS] Escaneie o QR Code que aparecerá abaixo:\n');
  
  try {
    await BaileysClient.start();
    
    // Configurar handler de mensagens
    BaileysClient.onMessage(handleWhatsAppMessage);
    
    console.log('\n✅ [INICIO] Bot iniciado com sucesso!');
    console.log(`📱 [INICIO] Número autorizado: ${ALLOWED_WHATSAPP}`);
    console.log('💡 [INICIO] Aguardando mensagens...\n');
    
  } catch (error) {
    console.error('\n❌ [INICIO] Erro ao iniciar Baileys:', error);
    console.error('💡 [INICIO] Verifique se você escaneou o QR Code corretamente\n');
    process.exit(1);
  }
}

// Tratamento de erros não capturados
process.on('unhandledRejection', (error) => {
  console.error('❌ [ERROR] Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ [ERROR] Uncaught exception:', error);
});

// Tratamento de encerramento gracioso
process.on('SIGINT', async () => {
  console.log('\n\n👋 [SHUTDOWN] Encerrando bot...');
  try {
    await BaileysClient.stop();
    console.log('✅ [SHUTDOWN] Desconectado do WhatsApp');
  } catch (error) {
    console.error('❌ [SHUTDOWN] Erro ao desconectar:', error);
  }
  process.exit(0);
});

// Iniciar bot
startBot().catch(console.error);
