// Título da apresentação fiel ao pedido do usuário.
//
// Antes, a capa recebia um headline escrito livremente pela IA ("Espanha:
// séculos de glória" para um pedido "historia da espanha") e o título salvo era
// o texto cru digitado, com os erros. A regra agora: a capa e o título salvo
// são O MESMO título que o usuário pediu, só com correção de ortografia,
// acentos e maiúsculas ("historia da espanha" → "História da Espanha").
//
// A correção vem da chamada de conteúdo (campo `deck_title`, custo de poucos
// tokens) e é VALIDADA aqui: se a IA reescreveu, traduziu ou acrescentou um
// subtítulo, a resposta é recusada (ou só a parte antes do ":" é aceita) e o
// título sai de uma correção determinística. Módulo puro — Deno e Vite.

/** Minúsculas, sem acento, só letras/dígitos e espaço simples. */
export function titleKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Distância de edição (Levenshtein) entre duas strings curtas. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// "faça uma apresentação sobre X", "quero slides de X", "create a presentation
// about X": o título é o assunto X. Só prefixos inequívocos de pedido.
const REQUEST_PREFIX = new RegExp(
  "^\\s*(?:(?:por\\s+favor|please)[,\\s]+)?" +
    "(?:(?:fa[cç]a|crie|cria|gere|gera|monte|elabore|prepare|quero|queria|preciso(?:\\s+de)?|me\\s+ajude\\s+a\\s+(?:fazer|criar)|make|create|generate|build|i\\s+need|haz|crea|genera|necesito)\\s+)" +
    "(?:(?:uma?|a|an|una?|me)\\s+)?" +
    "(?:apresenta[cç](?:ao|ão|oes|ões)|slides?|presentation|deck|presentaci[oó]n|aula)\\s+" +
    "(?:sobre|de|do|da|dos|das|acerca\\s+de|about|on|of)\\s+" +
    // Artigo logo depois da preposição ("sobre a história…" → "história…").
    "(?:(?:a|o|as|os|the|el|la|los|las)\\s+)?",
  "i",
);

/** Tira o "pedido" do começo do título, quando o usuário escreveu uma ordem em vez de um título. */
export function stripRequestPrefix(raw: string): string {
  const clean = raw.replace(/\s+/g, " ").trim();
  const stripped = clean.replace(REQUEST_PREFIX, "").replace(/[.!?\s]+$/, "").trim();
  return stripped.length >= 2 ? stripped : clean;
}

// Palavras curtas que ficam minúsculas no meio do título (pt, es, en).
const CONNECTORS = new Set([
  "a", "as", "o", "os", "um", "uma", "uns", "umas", "de", "da", "das", "do", "dos", "e", "em", "na", "nas", "no",
  "nos", "para", "pela", "pelas", "pelo", "pelos", "por", "com", "sem", "sob", "sobre", "entre", "ao", "aos", "à", "às",
  "el", "la", "las", "los", "del", "y", "en", "con", "the", "of", "and", "in", "on", "for", "to", "with", "an", "or", "ou",
]);

// Acentuação das palavras de título mais comuns em português — usada só
// quando a correção da IA não veio (ou foi recusada).
const PT_ACCENTS: Record<string, string> = {
  historia: "história", introducao: "introdução", ciencia: "ciência", ciencias: "ciências", saude: "saúde",
  educacao: "educação", revolucao: "revolução", politica: "política", politicas: "políticas", matematica: "matemática",
  fisica: "física", quimica: "química", musica: "música", inteligencia: "inteligência", comunicacao: "comunicação",
  administracao: "administração", gestao: "gestão", analise: "análise", tecnica: "técnica", tecnicas: "técnicas",
  publica: "pública", publicas: "públicas", america: "américa", africa: "áfrica", asia: "ásia", sao: "são",
  seculo: "século", seculos: "séculos", evolucao: "evolução", estrategia: "estratégia", estrategias: "estratégias",
  logistica: "logística", inovacao: "inovação", solucao: "solução", solucoes: "soluções", producao: "produção",
  relacoes: "relações", nutricao: "nutrição", agua: "água", sustentavel: "sustentável", acoes: "ações",
  economica: "econômica", economico: "econômico", geografica: "geográfica", biologica: "biológica",
  tecnologica: "tecnológica", periodo: "período", imperio: "império", japao: "japão", paises: "países",
  civilizacao: "civilização", civilizacoes: "civilizações", populacao: "população", eletrica: "elétrica",
  automacao: "automação", informacao: "informação", informacoes: "informações", gramatica: "gramática",
  independencia: "independência", republica: "república", farmacia: "farmácia", mecanica: "mecânica",
  eletronica: "eletrônica", genetica: "genética", climatica: "climática", climaticas: "climáticas",
  mudancas: "mudanças", mudanca: "mudança", proteina: "proteína", proteinas: "proteínas", celula: "célula",
  celulas: "células", atomo: "átomo", basico: "básico", basica: "básica", pratica: "prática", praticas: "práticas",
};

const capitalize = (w: string) => (w ? w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1) : w);

/**
 * Correção determinística (reserva): acentos das palavras comuns (só em
 * português), maiúscula inicial nas palavras de conteúdo, conectores em
 * minúsculas e siglas digitadas em maiúsculas preservadas.
 */
export function fallbackTitle(raw: string, language = "pt-BR"): string {
  const base = stripRequestPrefix(raw);
  const allCaps = base === base.toUpperCase() && /[A-ZÀ-Ý]/.test(base);
  const words = base.split(" ").filter(Boolean);
  const pt = language.toLowerCase().startsWith("pt");
  return words
    .map((word, i) => {
      // Sigla digitada em maiúsculas no meio de um título normal (TCC, IA, ONU).
      if (!allCaps && word.length >= 2 && word === word.toUpperCase() && /[A-ZÀ-Ý]/.test(word)) return word;
      const lower = word.toLocaleLowerCase("pt-BR");
      const accented = pt ? PT_ACCENTS[lower.normalize("NFD").replace(/[̀-ͯ]/g, "")] ?? lower : lower;
      // Palavra que o usuário já acentuou fica como ele escreveu (em minúsculas).
      const chosen = /[À-ſ]/.test(lower) ? lower : accented;
      if (i > 0 && CONNECTORS.has(chosen)) return chosen;
      return capitalize(chosen);
    })
    .join(" ")
    .slice(0, 200);
}

/** O candidato é o MESMO título, só com correções? (mesmas palavras, mesma ordem). */
export function isSameTitle(original: string, candidate: string): boolean {
  const a = titleKey(stripRequestPrefix(original));
  const b = titleKey(candidate);
  if (!a || !b) return false;
  if (a === b) return true;
  const wa = a.split(" ");
  const wb = b.split(" ");
  if (wa.length === wb.length) {
    // Palavra a palavra: só erro de digitação/acentuação, nunca sinônimo
    // ("jovens" → "adolescentes" é reescrita, não correção).
    return wa.every((w, i) => editDistance(w, wb[i]) <= Math.max(1, Math.floor(w.length / 3)));
  }
  // Uma palavra a mais/menos só quando o usuário juntou/separou palavras
  // ("fotos sintese" → "fotossíntese"): o texto sem espaços é o mesmo.
  return Math.abs(wa.length - wb.length) === 1 && a.replace(/ /g, "") === b.replace(/ /g, "");
}

const SUBTITLE_SPLIT = /\s*(?::|—|–|\s-\s|\|)\s*/;

export interface DeckTitleResult {
  title: string;
  /** "ai": correção da IA aceita; "fallback": correção determinística. */
  source: "ai" | "fallback";
}

/**
 * Título final da apresentação: a correção da IA quando ela é o mesmo título
 * (inteira, ou a parte antes de um subtítulo acrescentado); senão, a correção
 * determinística do que o usuário digitou.
 */
export function resolveDeckTitle(userTitle: string, aiTitle: unknown, language = "pt-BR"): DeckTitleResult {
  const raw = String(userTitle ?? "").replace(/\s+/g, " ").trim();
  if (typeof aiTitle === "string") {
    // eslint-disable-next-line no-control-regex -- remove caracteres de controle de propósito
    const candidate = aiTitle.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().replace(/^["'“”«»]+|["'“”«».]+$/g, "");
    const head = candidate.split(SUBTITLE_SPLIT)[0]?.trim() ?? "";
    for (const c of [candidate, head]) {
      if (c && c.length <= 200 && isSameTitle(raw, c)) return { title: c, source: "ai" };
    }
  }
  return { title: fallbackTitle(raw, language) || raw, source: "fallback" };
}
