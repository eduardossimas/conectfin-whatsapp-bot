// index-baileys.js
// Exemplo de como usar o Baileys ao invés do WAHA
import "dotenv/config";
import express from "express";
import morgan from "morgan";
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
const ALLOWED_WHATSAPP = "+553291473412"; // Configure seu número aqui

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
    console.error('❌ [SEND] Erro ao enviar mensagem:', error);
    throw error;
  }
}

// ========================= FUNÇÕES DE ANÁLISE (mesmas do index.js) =========================
// [Copie aqui todas as funções de análise do index.js original]
// - runLLM, runLLMGemini
// - analyzeInlineAudio, analyzeInlineImage, analyzeInlinePdf, analyzeFreeText
// - getUserByPhone, getBancoIdPadrao, getAllUserCategorias, findBestCategoriaWithAI
// - createLancamento, analyzeDocumentContent

// ========================= CARREGAR PROMPTS =========================
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

// ========================= HELPER LLM (EXEMPLO) =========================
const OPENAI_MODEL = "gpt-4o-mini";
const GEMINI_PRIMARY = "gemini-2.0-flash-exp";
const GEMINI_FALLBACK = "gemini-1.5-flash";

async function runLLM(system, userParts, retryCount = 0) {
  // [Copie a implementação completa do index.js]
  // Por ora, um exemplo simplificado:
  const model = genAI.getGenerativeModel({
    model: GEMINI_PRIMARY,
    systemInstruction: system,
  });
  
  const res = await model.generateContent({
    contents: [{ role: "user", parts: userParts }],
  });
  
  const txt = res.response.text().trim();
  return txt.replace(/```json|```/g, "").trim();
}

async function analyzeFreeText(text) {
  const today = dayjs().format("YYYY-MM-DD");
  const prompt = `NOW_ISO="${today}", text="${text}"`;
  const jsonStr = await runLLM(SYSTEM_PARSER, [{ text: prompt }]);
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

async function analyzeInlineAudio({ buffer, mime }) {
  const today = dayjs().format("YYYY-MM-DD");
  const base64 = buffer.toString("base64");
  const jsonStr = await runLLM(SYSTEM_PARSER, [
    { inlineData: { data: base64, mimeType: mime || "audio/ogg" } },
    { text: `NOW_ISO="${today}"\nExtraia os campos do áudio acima.` },
  ]);
  return JSON.parse(jsonStr);
}

async function analyzeInlinePdf({ buffer }) {
  const today = dayjs().format("YYYY-MM-DD");
  
  try {
    console.log(`📄 [PDF] Extraindo texto do PDF...`);
    const { text } = await pdfParse(buffer);
    console.log(`📄 [PDF] Texto extraído: ${text.length} caracteres`);
    
    if (!text || text.trim().length === 0) {
      throw new Error("PDF não contém texto legível");
    }
    
    const extractionPrompt = `NOW_ISO="${today}"

TEXTO DO PDF:
${text.substring(0, 2000)}

Extraia os dados financeiros e retorne APENAS o JSON no formato especificado.`;

    const jsonStr = await runLLM(SYSTEM_PARSER, [
      { text: extractionPrompt },
    ]);
    
    return JSON.parse(jsonStr);
    
  } catch (error) {
    console.error(`❌ [PDF] Erro ao processar PDF:`, error.message);
    return {
      descricao: "Documento não processado",
      valor: null,
      tipo_lancamento: null,
      data_competencia: today,
      needs_fix: true,
      missing: ["valor", "tipo_lancamento", "descricao"],
      confidence: 0.0,
      suggestions: ["Não foi possível processar o documento automaticamente."]
    };
  }
}

// ========================= HELPER SUPABASE (EXEMPLO) =========================
async function getUserByPhone(whats) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("phone_e164", whats)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getBancoIdPadrao(user_id) {
  if (!user_id) return null;

  const { data: bancoPrincipal } = await supabase
    .from("bancos")
    .select("id, nome_banco, is_principal")
    .eq("user_id", user_id)
    .eq("is_principal", true)
    .limit(1);

  if (bancoPrincipal && bancoPrincipal.length > 0) {
    return bancoPrincipal[0].id;
  }

  const { data: ultimoBanco } = await supabase
    .from("bancos")
    .select("id, nome_banco")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (ultimoBanco && ultimoBanco.length > 0) {
    return ultimoBanco[0].id;
  }

  return null;
}

async function createLancamento({
  user_id,
  tipo,
  descricao,
  valor,
  data_competencia,
  data_pagamento = null,
  data_vencimento = null,
  banco_id,
  categoria_id,
  origem = "whatsapp",
}) {
  if (!banco_id) throw new Error("Nenhum banco encontrado.");
  if (!valor && valor !== 0) throw new Error("valor é obrigatório.");
  if (!descricao) throw new Error("descricao é obrigatória.");
  if (!data_competencia) throw new Error("data_competencia é obrigatória.");

  const rowToInsert = {
    descricao,
    valor,
    data_lancamento: data_competencia,
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

// ========================= HANDLER DE MENSAGENS BAILEYS =========================
async function handleWhatsAppMessage(message) {
  try {
    console.log('\n🔄 [HANDLER] Processando mensagem...');
    
    // Parsear mensagem usando o cliente Baileys
    const parsed = await BaileysClient.parseMessage(message);
    
    const { from, type, text, caption, media } = parsed;
    
    console.log(`📱 [HANDLER] De: ${from}, Tipo: ${type}`);
    
    // Verificar autorização
    if (from !== ALLOWED_WHATSAPP) {
      console.log(`⚠️ [AUTH] Número não autorizado: ${from}. Ignorando.`);
      return;
    }
    
    console.log(`✅ [AUTH] Número autorizado`);
    
    // Buscar usuário
    const user = await getUserByPhone(from);
    if (!user) {
      await sendWhatsAppText({
        to: from,
        text: "Usuário não encontrado. Cadastre seu número no ConectFin.",
      });
      return;
    }
    
    console.log(`✅ [USER] Usuário encontrado: ${user.nome || user.id}`);
    
    // Processar baseado no tipo
    let analyzed;
    
    if (type === 'text') {
      console.log(`📝 [ANALYZE] Analisando texto: "${text}"`);
      analyzed = await analyzeFreeText(text);
    } else if (type === 'image' && media) {
      console.log(`🖼️ [ANALYZE] Analisando imagem com caption: "${caption}"`);
      analyzed = await analyzeInlineImage({
        buffer: media.buffer,
        mime: media.mimetype,
        caption
      });
    } else if (type === 'audio' && media) {
      console.log(`🎵 [ANALYZE] Analisando áudio`);
      analyzed = await analyzeInlineAudio({
        buffer: media.buffer,
        mime: media.mimetype
      });
    } else if (type === 'document' && media) {
      if (media.mimetype.includes('pdf')) {
        console.log(`📄 [ANALYZE] Analisando PDF`);
        analyzed = await analyzeInlinePdf({
          buffer: media.buffer
        });
      } else {
        console.log(`📄 [ANALYZE] Documento não-PDF, analisando como texto`);
        analyzed = await analyzeFreeText(caption || "Documento enviado");
      }
    } else {
      await sendWhatsAppText({
        to: from,
        text: "Tipo de mensagem não suportado. Envie texto, imagem, áudio ou PDF."
      });
      return;
    }
    
    console.log(`✅ [ANALYZE] Análise concluída:`, JSON.stringify(analyzed, null, 2));
    
    // Normalizar dados
    const today = dayjs().format("YYYY-MM-DD");
    const payloadOut = {
      tipo: analyzed.tipo_lancamento || "despesa",
      descricao: analyzed.descricao || (caption || text || "").slice(0, 140),
      valor: analyzed.valor != null ? Number(analyzed.valor) : null,
      data_competencia: analyzed.data_competencia || today,
      data_pagamento: analyzed.data_pagamento || null,
      data_vencimento: analyzed.data_vencimento || null,
      categoria_sugerida: analyzed.categoria_sugerida || null,
      needs_fix: analyzed.needs_fix || false,
      confidence: analyzed.confidence || 0.0,
    };
    
    // Verificar se precisa correção
    if (payloadOut.needs_fix) {
      const errorMessage = `❌ Informações incompletas!\n\nFaltando: ${analyzed.missing?.join(', ')}\n\nSugestão: ${analyzed.suggestions?.join(' ')}\n\nTente novamente.`;
      await sendWhatsAppText({ to: from, text: errorMessage });
      return;
    }
    
    // Buscar banco e criar lançamento
    const id_banco = await getBancoIdPadrao(user.id);
    
    if (!id_banco) {
      await sendWhatsAppText({
        to: from,
        text: "❌ Você ainda não tem nenhum banco configurado. Configure no ConectFin primeiro."
      });
      return;
    }
    
    const lanc = await createLancamento({
      user_id: user.id,
      tipo: payloadOut.tipo,
      descricao: payloadOut.descricao,
      valor: payloadOut.valor,
      data_competencia: payloadOut.data_competencia,
      data_pagamento: payloadOut.data_pagamento,
      data_vencimento: payloadOut.data_vencimento,
      banco_id: id_banco,
      categoria_id: null, // Simplificado para o exemplo
    });
    
    // Enviar confirmação
    const confirm = [
      `✅ Lançamento criado!`,
      `• Tipo: ${payloadOut.tipo}`,
      `• Descrição: ${payloadOut.descricao || "-"}`,
      `• Valor: R$ ${Number(payloadOut.valor).toFixed(2)}`,
      `• Data: ${payloadOut.data_competencia}`,
      `ID: ${lanc.id}`,
    ].join("\n");
    
    await sendWhatsAppText({ to: from, text: confirm });
    console.log(`🎉 [HANDLER] Lançamento criado com sucesso!`);
    
  } catch (error) {
    console.error('❌ [HANDLER] Erro:', error);
    
    try {
      const parsed = await BaileysClient.parseMessage(message);
      await sendWhatsAppText({
        to: parsed.from,
        text: "❌ Erro ao processar sua mensagem. Tente novamente."
      });
    } catch (sendError) {
      console.error('❌ [HANDLER] Erro ao enviar mensagem de erro:', sendError);
    }
  }
}

// ========================= INICIALIZAÇÃO =========================
async function main() {
  console.log('\n🚀 [INICIO] Iniciando ConectFin Bot com Baileys...\n');
  
  // Iniciar servidor Express
  app.listen(PORT, () => {
    console.log(`✅ [SERVER] Servidor rodando na porta ${PORT}`);
  });
  
  // Rotas básicas
  app.get("/", (_req, res) => res.send("ConectFin Bot com Baileys!"));
  
  // Iniciar Baileys
  console.log('\n📱 [BAILEYS] Iniciando conexão com WhatsApp...\n');
  await BaileysClient.start();
  
  // Configurar handler de mensagens
  BaileysClient.onMessage(handleWhatsAppMessage);
  
  console.log('\n✅ [INICIO] Bot iniciado com sucesso!\n');
  console.log('💡 [INFO] Aguardando mensagens...\n');
}

// Tratamento de erros não capturados
process.on('unhandledRejection', (error) => {
  console.error('❌ [ERROR] Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ [ERROR] Uncaught exception:', error);
});

// Iniciar aplicação
main().catch(console.error);
