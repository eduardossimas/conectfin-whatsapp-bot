# 📦 Guia Rápido: Configurar Supabase Storage

## 🎯 Passo a Passo

### 1. Acessar o Supabase

1. Vá para: https://supabase.com/dashboard
2. Selecione seu projeto: **oqjenefkbgowshyqfgls**

### 2. Criar Bucket de Storage

1. No menu lateral, clique em **"Storage"**
2. Clique em **"New bucket"** (botão verde)
3. Preencha:
   - **Name**: `whatsapp-media`
   - **Public bucket**: ✅ **MARQUE ESTA OPÇÃO** (importante!)
   - **File size limit**: 50 MB (padrão está bom)
   - **Allowed MIME types**: Deixe vazio (aceita todos)
4. Clique em **"Create bucket"**

### 3. Configurar Políticas (RLS)

Depois de criar o bucket, você precisa permitir acesso público:

1. Clique no bucket **whatsapp-media** que você acabou de criar
2. Vá na aba **"Policies"**
3. Clique em **"New Policy"**
4. Escolha: **"Allow public access"** ou **"Custom"**
5. Se escolher Custom, adicione esta política:

```sql
-- Permitir leitura pública
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'whatsapp-media' );

-- Permitir inserção (seu bot)
CREATE POLICY "Authenticated can insert"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'whatsapp-media' );

-- Permitir deleção (limpeza automática)
CREATE POLICY "Authenticated can delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'whatsapp-media' );
```

Ou simplesmente clique em **"Allow public read access"** se disponível.

### 4. Testar

Volte para a aba **"Objects"** do bucket e tente fazer upload manual de uma imagem de teste para verificar se funciona.

---

## ✅ Verificação

Depois de criar, teste se está funcionando:

```bash
# No terminal do seu bot
npm run unified
```

Quando enviar uma imagem, você deve ver nos logs:

```
📤 [MEDIA] Salvando mídia: chart (xxxxx bytes)
📤 [MEDIA] Tipo: image/png
📤 [MEDIA] Método: supabase
✅ [MEDIA] Arquivo enviado para Supabase: whatsapp-media/1234567890_chart.png
🔗 [MEDIA] URL: https://oqjenefkbgowshyqfgls.supabase.co/storage/v1/object/public/whatsapp-media/...
⏰ [MEDIA] Agendada exclusão de whatsapp-media/1234567890_chart.png em 7 dias
```

---

## 🗑️ Limpeza Automática

O sistema está configurado para:

1. **Ao fazer upload**: Agenda exclusão automática após 7 dias
2. **Ao iniciar o bot**: Limpa todos os arquivos com mais de 7 dias

Você pode alterar o prazo no `.env`:
```bash
MEDIA_RETENTION_DAYS=7  # Altere para 3, 14, 30, etc
```

---

## 🆘 Troubleshooting

### "Erro ao enviar para Supabase: new row violates row-level security"
**Solução**: Você esqueceu de criar as políticas (passo 3). Crie as políticas de INSERT e DELETE.

### "Erro ao enviar para Supabase: Bucket not found"
**Solução**: O nome do bucket está errado. Certifique-se que criou com o nome exato: `whatsapp-media`

### Imagem não aparece no WhatsApp
**Solução**: O bucket não está público. Volte no passo 2 e marque **"Public bucket"**.

### "Unauthorized"
**Solução**: Verifique se seu `SUPABASE_SERVICE_ROLE` no `.env` está correto (é a **Service Role Key**, não a **anon key**).

---

## 💡 Dicas

- O Supabase Storage tem **1GB grátis** no plano free
- Imagens de gráficos geralmente têm ~50-200KB cada
- Com 1GB você consegue armazenar ~5.000-20.000 imagens
- Com limpeza de 7 dias, você provavelmente nunca vai atingir o limite

---

**Pronto!** Depois de configurar o bucket, seu bot vai salvar todas as imagens no Supabase automaticamente. 🎉
