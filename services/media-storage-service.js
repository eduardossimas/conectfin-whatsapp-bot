/**
 * Serviço de Armazenamento de Mídia
 * 
 * WABA (WhatsApp Business API) requer que imagens sejam enviadas via URL pública.
 * Este serviço oferece diferentes opções de armazenamento:
 * 
 * 1. Local + ngrok (desenvolvimento)
 * 2. AWS S3 (produção)
 * 3. Cloudinary (alternativa)
 * 4. Supabase Storage (se você já usa Supabase)
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { config } from '../config/environment.js';

// ======================= CONFIGURAÇÃO =======================

const STORAGE_TYPE = process.env.MEDIA_STORAGE || 'local'; // 'local', 's3', 'cloudinary', 'supabase'
const MEDIA_DIR = 'public/media';
const BASE_URL = process.env.WABA_MEDIA_BASE_URL || `http://localhost:${process.env.PORT || 3000}/media`;

// ======================= ARMAZENAMENTO LOCAL =======================

/**
 * Salva arquivo localmente e retorna URL
 * Útil para desenvolvimento com ngrok
 */
async function saveLocal(buffer, filename, mimetype) {
  // Cria diretório se não existir
  if (!existsSync(MEDIA_DIR)) {
    await mkdir(MEDIA_DIR, { recursive: true });
  }
  
  // Adiciona timestamp para evitar conflitos
  const timestamp = Date.now();
  const extension = mimetype.split('/')[1] || 'jpg';
  const finalFilename = `${timestamp}_${filename}.${extension}`;
  const filepath = join(MEDIA_DIR, finalFilename);
  
  // Salva arquivo
  await writeFile(filepath, buffer);
  
  // Retorna URL pública
  const url = `${BASE_URL}/${finalFilename}`;
  
  console.log(`✅ [MEDIA] Arquivo salvo localmente: ${filepath}`);
  console.log(`🔗 [MEDIA] URL: ${url}`);
  
  return url;
}

// ======================= AWS S3 =======================

/**
 * Faz upload para AWS S3 e retorna URL
 * Requer: npm install @aws-sdk/client-s3
 */
async function saveS3(buffer, filename, mimetype) {
  try {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
    
    const timestamp = Date.now();
    const extension = mimetype.split('/')[1] || 'jpg';
    const key = `conectfin/${timestamp}_${filename}.${extension}`;
    
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      ACL: 'public-read' // Torna público
    });
    
    await s3Client.send(command);
    
    const url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    
    console.log(`✅ [MEDIA] Arquivo enviado para S3: ${key}`);
    console.log(`🔗 [MEDIA] URL: ${url}`);
    
    return url;
    
  } catch (error) {
    console.error('❌ [MEDIA] Erro ao enviar para S3:', error);
    throw error;
  }
}

// ======================= CLOUDINARY =======================

/**
 * Faz upload para Cloudinary e retorna URL
 * Requer: npm install cloudinary
 */
async function saveCloudinary(buffer, filename, mimetype) {
  try {
    const cloudinary = await import('cloudinary');
    
    // Configura Cloudinary
    cloudinary.v2.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    
    // Converte buffer para base64
    const base64 = `data:${mimetype};base64,${buffer.toString('base64')}`;
    
    // Upload
    const result = await cloudinary.v2.uploader.upload(base64, {
      folder: 'conectfin',
      public_id: `${Date.now()}_${filename}`,
      resource_type: 'auto'
    });
    
    console.log(`✅ [MEDIA] Arquivo enviado para Cloudinary: ${result.public_id}`);
    console.log(`🔗 [MEDIA] URL: ${result.secure_url}`);
    
    return result.secure_url;
    
  } catch (error) {
    console.error('❌ [MEDIA] Erro ao enviar para Cloudinary:', error);
    throw error;
  }
}

// ======================= SUPABASE STORAGE =======================

/**
 * Faz upload para Supabase Storage e retorna URL
 * Usa o mesmo cliente Supabase que você já tem configurado
 */
async function saveSupabase(buffer, filename, mimetype) {
  try {
    const { supabase } = await import('./database-service.js');
    
    const timestamp = Date.now();
    const extension = mimetype.split('/')[1] || 'jpg';
    const filepath = `whatsapp-media/${timestamp}_${filename}.${extension}`;
    
    // Upload para Supabase Storage
    const { data, error } = await supabase.storage
      .from('whatsapp-media') // Nome do bucket (você precisa criar no Supabase)
      .upload(filepath, buffer, {
        contentType: mimetype,
        upsert: false
      });
    
    if (error) throw error;
    
    // Pega URL pública
    const { data: urlData } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(filepath);
    
    const url = urlData.publicUrl;
    
    console.log(`✅ [MEDIA] Arquivo enviado para Supabase: ${filepath}`);
    console.log(`🔗 [MEDIA] URL: ${url}`);
    
    // Agendar limpeza automática
    scheduleCleanup(filepath);
    
    return url;
    
  } catch (error) {
    console.error('❌ [MEDIA] Erro ao enviar para Supabase:', error);
    throw error;
  }
}

/**
 * Agenda limpeza automática do arquivo
 */
function scheduleCleanup(filepath) {
  const retentionDays = parseInt(process.env.MEDIA_RETENTION_DAYS) || 7;
  const deleteAfter = retentionDays * 24 * 60 * 60 * 1000; // Converte dias para ms
  
  setTimeout(async () => {
    try {
      const { supabase } = await import('./database-service.js');
      
      const { error } = await supabase.storage
        .from('whatsapp-media')
        .remove([filepath]);
      
      if (error) {
        console.error(`❌ [MEDIA] Erro ao deletar ${filepath}:`, error.message);
      } else {
        console.log(`🗑️ [MEDIA] Arquivo deletado automaticamente: ${filepath}`);
      }
    } catch (error) {
      console.error('❌ [MEDIA] Erro na limpeza automática:', error);
    }
  }, deleteAfter);
  
  console.log(`⏰ [MEDIA] Agendada exclusão de ${filepath} em ${retentionDays} dias`);
}

// ======================= FUNÇÃO PRINCIPAL =======================

/**
 * Salva mídia e retorna URL pública
 * Detecta automaticamente o método de armazenamento configurado
 * 
 * @param {Buffer} buffer - Buffer do arquivo
 * @param {string} filename - Nome do arquivo (sem extensão)
 * @param {string} mimetype - Tipo MIME (image/png, image/jpeg, etc)
 * @returns {Promise<string>} - URL pública do arquivo
 */
export async function saveMedia(buffer, filename = 'image', mimetype = 'image/jpeg') {
  console.log(`📤 [MEDIA] Salvando mídia: ${filename} (${buffer.length} bytes)`);
  console.log(`📤 [MEDIA] Tipo: ${mimetype}`);
  console.log(`📤 [MEDIA] Método: ${STORAGE_TYPE}`);
  
  try {
    switch (STORAGE_TYPE) {
      case 's3':
        return await saveS3(buffer, filename, mimetype);
      
      case 'cloudinary':
        return await saveCloudinary(buffer, filename, mimetype);
      
      case 'supabase':
        return await saveSupabase(buffer, filename, mimetype);
      
      case 'local':
      default:
        return await saveLocal(buffer, filename, mimetype);
    }
  } catch (error) {
    console.error('❌ [MEDIA] Erro ao salvar mídia:', error);
    
    // Fallback para local se outro método falhar
    if (STORAGE_TYPE !== 'local') {
      console.log('⚠️ [MEDIA] Tentando fallback para armazenamento local...');
      return await saveLocal(buffer, filename, mimetype);
    }
    
    throw error;
  }
}

/**
 * Retorna configuração de mídia
 */
export function getMediaConfig() {
  return {
    storageType: STORAGE_TYPE,
    baseUrl: BASE_URL,
    mediaDir: MEDIA_DIR
  };
}

/**
 * Limpa arquivos antigos do Supabase Storage
 * Deve ser chamado periodicamente (ex: ao iniciar o servidor)
 */
export async function cleanOldMedia() {
  if (STORAGE_TYPE !== 'supabase') {
    console.log('⏭️ [MEDIA] Limpeza automática só funciona com Supabase Storage');
    return;
  }
  
  try {
    const { supabase } = await import('./database-service.js');
    const retentionDays = parseInt(process.env.MEDIA_RETENTION_DAYS) || 7;
    const cutoffDate = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    
    console.log(`🧹 [MEDIA] Iniciando limpeza de arquivos com mais de ${retentionDays} dias...`);
    
    // Lista todos os arquivos
    const { data: files, error: listError } = await supabase.storage
      .from('whatsapp-media')
      .list('whatsapp-media', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'asc' }
      });
    
    if (listError) {
      console.error('❌ [MEDIA] Erro ao listar arquivos:', listError);
      return;
    }
    
    if (!files || files.length === 0) {
      console.log('✅ [MEDIA] Nenhum arquivo para limpar');
      return;
    }
    
    // Filtra arquivos antigos
    const filesToDelete = files.filter(file => {
      // Extrai timestamp do nome do arquivo (formato: timestamp_nome.ext)
      const match = file.name.match(/^(\d+)_/);
      if (!match) return false;
      
      const fileTimestamp = parseInt(match[1]);
      return fileTimestamp < cutoffDate;
    });
    
    if (filesToDelete.length === 0) {
      console.log('✅ [MEDIA] Nenhum arquivo antigo encontrado');
      return;
    }
    
    console.log(`🗑️ [MEDIA] Encontrados ${filesToDelete.length} arquivos para deletar`);
    
    // Deleta em lotes
    const pathsToDelete = filesToDelete.map(f => `whatsapp-media/${f.name}`);
    const { error: deleteError } = await supabase.storage
      .from('whatsapp-media')
      .remove(pathsToDelete);
    
    if (deleteError) {
      console.error('❌ [MEDIA] Erro ao deletar arquivos:', deleteError);
    } else {
      console.log(`✅ [MEDIA] ${filesToDelete.length} arquivos antigos deletados com sucesso`);
    }
    
  } catch (error) {
    console.error('❌ [MEDIA] Erro na limpeza periódica:', error);
  }
}

export default {
  saveMedia,
  getMediaConfig,
  cleanOldMedia
};
