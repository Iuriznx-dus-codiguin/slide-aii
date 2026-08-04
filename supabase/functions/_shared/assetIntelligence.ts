// Asset Intelligence Engine (Fase 5 da nova arquitetura de motores).
//
// Por que fica em fetch-image, não em generate-presentation: mapeando o
// pipeline real (ver auditoria), generate-presentation só DECIDE a
// estratégia (image_strategy: pexels|ai|none) e o prompt/query por slide —
// quem busca o pixel de verdade é fetch-image, chamado depois, por slide,
// pelo frontend (Generate.tsx, Editor.tsx). É aqui que o dinheiro é
// efetivamente gasto (COSTS.aiImage = $0.039 por chamada "ai" bem-sucedida),
// então é aqui que reaproveitar um asset já gerado tem valor real e imediato.
//
// Escopo: só a estratégia "ai" (o único caminho com custo em dólar por
// chamada — ver comentário de segurança no topo de fetch-image/index.ts).
// "pexels" já não tem custo direto, então cachear ali tem retorno bem menor;
// fica como extensão natural futura, não neste v1.
//
// Sinal de match: sobreposição de palavras-chave entre o prompt pedido agora
// e o `query` salvo de cada asset anterior do MESMO usuário (metadata->>style
// precisa bater exatamente — um "3d-render" nunca deve substituir um
// "photo"). Não é análise de pixel (ao contrário de imageAnalysis.ts, que já
// faz isso client-side para outra finalidade) — é matching por contexto de
// geração, rápido e sem custo de rede extra.

export interface AssetRecord {
  id: string;
  url: string;
  style: string | null;
  query: string;
  usage_count: number;
}

function normalizeWords(s: string): Set<string> {
  return new Set(
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2),
  );
}

/** Proporção do menor conjunto de palavras coberta pela interseção — 0..1. */
function overlapScore(a: string, b: string): number {
  const wa = normalizeWords(a);
  const wb = normalizeWords(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / Math.min(wa.size, wb.size);
}

// Pelo menos metade das palavras-chave relevantes do conjunto menor batendo.
// Calibrado conservador de propósito: um falso positivo aqui devolve uma
// imagem de contexto errado pro usuário; um falso negativo só custa cair no
// caminho de geração normal (comportamento de antes desta feature).
const MATCH_THRESHOLD = 0.5;

/**
 * Busca um asset de IA já gerado pelo mesmo usuário que combine com o
 * pedido atual. Nunca lança exceção — falha aqui deve cair no comportamento
 * de geração normal (pré-Fase 5), nunca bloquear fetch-image.
 */
export async function findMatchingAsset(
  admin: any,
  userId: string | null,
  style: string | undefined,
  queryText: string,
): Promise<AssetRecord | null> {
  if (!userId || !queryText.trim()) return null;
  try {
    let q = admin.from("assets").select("id,url,metadata,query,usage_count")
      .eq("user_id", userId).eq("source", "ai").order("last_used_at", { ascending: false }).limit(40);
    if (style) q = q.eq("metadata->>style", style);
    const { data, error } = await q;
    if (error || !data?.length) return null;
    let best: any = null;
    let bestScore = 0;
    for (const row of data) {
      const score = overlapScore(queryText, row.query ?? "");
      if (score > bestScore) { bestScore = score; best = row; }
    }
    if (!best || bestScore < MATCH_THRESHOLD) return null;
    return { id: best.id, url: best.url, style: best.metadata?.style ?? null, query: best.query, usage_count: best.usage_count };
  } catch (e) {
    console.warn("assetIntelligence: lookup falhou (não bloqueia fetch-image) —", (e as Error).message);
    return null;
  }
}

// Imagens da OpenAI frequentemente voltam como data:image/...;base64,XXXX
// (dezenas a centenas de KB como string) em vez de uma URL hospedada. Cachear
// isso na tabela infla o banco por pouco ganho — reaproveitar só compensa
// quando é uma URL http leve de guardar e devolver de novo. Um data-URL não
// utilizável como cache ainda assim foi gerado e devolvido ao usuário
// normalmente; só não entra na biblioteca de reaproveitamento.
const MAX_CACHEABLE_URL_LENGTH = 2000;

function isCacheableUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) && url.length <= MAX_CACHEABLE_URL_LENGTH;
}

/**
 * Registra um ativo na biblioteca do usuário — tanto os gerados por IA
 * (source="ai", os que custam dinheiro e alimentam o cache de
 * reaproveitamento) quanto os vindos da Pexels (source="pexels", registrados
 * para que a interface consiga listar TODOS os ativos de uma apresentação,
 * não só metade deles).
 *
 * Consistência (auditoria desta rodada): antes este insert era cego — duas
 * requisições concorrentes com a mesma imagem criavam DUAS linhas, e um
 * mesmo asset reaproveitado em outra apresentação duplicava de novo. Agora
 * usa upsert sobre o índice único (user_id, url), então a tabela tem no
 * máximo uma linha por imagem por usuário, com o contador de uso somando em
 * cima da linha existente.
 *
 * Fire-and-forget seguro (nunca lança) — falha aqui jamais pode bloquear a
 * entrega da imagem ao usuário.
 */
export async function recordAsset(
  admin: any,
  userId: string | null,
  url: string,
  style: string | undefined,
  queryText: string,
  source: "ai" | "pexels" = "ai",
): Promise<void> {
  if (!userId || !url || !isCacheableUrl(url)) return;
  try {
    // Se já existe, só atualiza uso/recência — não cria duplicata.
    const { data: existing } = await admin.from("assets")
      .select("id,usage_count").eq("user_id", userId).eq("url", url).maybeSingle();
    if (existing?.id) {
      await touchAsset(admin, existing.id, existing.usage_count ?? 0);
      return;
    }
    const { error } = await admin.from("assets").upsert({
      user_id: userId, url, source,
      query: queryText.slice(0, 500),
      metadata: { style: style ?? null },
    }, { onConflict: "user_id,url", ignoreDuplicates: true });
    if (error) console.warn("assetIntelligence: registro falhou —", error.message);
  } catch (e) {
    console.warn("assetIntelligence: registro falhou (não bloqueia fetch-image) —", (e as Error).message);
  }
}

/** Atualiza o contador de uso quando um asset existente é reaproveitado. Não crítico — falha silenciosa é aceitável. */
export async function touchAsset(admin: any, id: string, currentUsageCount: number): Promise<void> {
  try {
    await admin.from("assets").update({ usage_count: (currentUsageCount ?? 0) + 1, last_used_at: new Date().toISOString() }).eq("id", id);
  } catch {
    // contador de popularidade, não afeta cobrança nem segurança — falha aqui é aceitável.
  }
}

