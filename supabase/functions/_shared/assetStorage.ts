// Persistência de imagens geradas por IA (complemento da Fase 5 — Asset Intelligence).
//
// Problema que este módulo resolve: a OpenAI Images API (gpt-image-1-mini)
// devolve a imagem como `b64_json`, ou seja, um data-URL de centenas de KB.
// Esse data-URL era gravado direto em slides.content.image_url e passado a
// recordAsset() — que o descarta por exceder MAX_CACHEABLE_URL_LENGTH. Ou
// seja, na prática a biblioteca de assets NUNCA crescia com imagens da
// OpenAI (o caminho caro, $0.039/chamada), e o banco inflava com base64 em
// cada slide. A Fase 5 existia no código mas não economizava nada.
//
// Solução: subir o binário para o bucket privado `slide-images` e devolver
// uma signed URL de longa validade. Bucket privado + signed URL (em vez de
// bucket público) porque buckets públicos estão bloqueados neste projeto —
// signed URLs ignoram RLS e servem o arquivo direto pela CDN, então o
// visualizador público continua funcionando sem sessão.
//
// Nunca lança: qualquer falha aqui devolve o data-URL original, mantendo
// exatamente o comportamento anterior.

const BUCKET = "slide-images";
/** ~10 anos. Uma apresentação publicada precisa continuar renderizando indefinidamente. */
const SIGNED_URL_TTL_SECONDS = 315_360_000;
/**
 * Tetos aplicados no único ponto de escrita do bucket (o bucket em si não
 * expõe configuração de limite pelas ferramentas disponíveis). Serve de
 * proteção contra upload de arquivo inesperadamente grande ou de tipo não
 * previsto vindo de uma resposta de provedor de IA.
 */
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = ["image/webp", "image/png", "image/jpeg", "image/jpg", "image/avif"];

function parseDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string; ext: string } | null {
  const m = dataUrl.match(/^data:([^;,]+);base64,(.+)$/s);
  if (!m) return null;
  const contentType = m[1].toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) return null;
  const bin = atob(m[2]);
  if (bin.length > MAX_UPLOAD_BYTES) return null;
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "webp";
  return { bytes, contentType, ext };
}

/**
 * Se `url` for um data-URL, sobe para o Storage e devolve uma signed URL
 * persistente. Caso contrário (já é http), devolve a URL como veio.
 */
export async function persistGeneratedImage(
  admin: any,
  userId: string | null,
  url: string,
): Promise<string> {
  if (!url.startsWith("data:")) return url;
  try {
    const parsed = parseDataUrl(url);
    if (!parsed) return url;
    const path = `${userId ?? "anon"}/${crypto.randomUUID()}.${parsed.ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, parsed.bytes, {
      contentType: parsed.contentType,
      cacheControl: "31536000",
      upsert: false,
    });
    if (upErr) {
      console.warn("assetStorage: upload falhou, mantendo data-URL —", upErr.message);
      return url;
    }
    const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      console.warn("assetStorage: signed URL falhou, mantendo data-URL —", error?.message);
      return url;
    }
    return data.signedUrl;
  } catch (e) {
    console.warn("assetStorage: persistência falhou (não bloqueia fetch-image) —", (e as Error).message);
    return url;
  }
}
