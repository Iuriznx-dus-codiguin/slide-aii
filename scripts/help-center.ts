// Central de Ajuda como código.
//
// Os artigos vivem em docs/central-de-ajuda/artigos/<categoria>/<slug>.md,
// com um cabeçalho simples:
//
//   ---
//   slug: creditos-consumo
//   title: Como funcionam os créditos
//   category: planos
//   keywords: créditos, saldo, cota mensal
//   ---
//   Corpo em Markdown…
//
// Este script valida os arquivos e gera a migração que publica o conteúdo
// na tabela help_articles (upsert por slug), além de corrigir os links do
// catálogo de erros. Uso:
//
//   node --experimental-strip-types scripts/help-center.ts
//
// O teste src/test/helpCenterContent.test.ts falha se a migração gerada
// estiver desatualizada em relação aos arquivos.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const HELP_CATEGORIES = [
  "comecar",
  "geracao",
  "editor",
  "apresentacao",
  "exportacao",
  "planos",
  "conta",
  "privacidade",
  "autenticacao",
  "suporte",
] as const;

export interface HelpArticleSource {
  slug: string;
  title: string;
  category: string;
  keywords: string[];
  content: string;
  file: string;
}

/** Artigos antigos que foram fundidos em outros e saem da Central. */
export const RETIRED_SLUGS: string[] = ["imagens-pexels-e-ia"];

/** Artigos relacionados de cada código do catálogo de erros (painel de suporte e páginas de artigo). */
export const ERROR_ARTICLE_LINKS: Record<string, string[]> = {
  "ACC-001": ["excluir-conta", "meus-dados-lgpd"],
  "AUTH-001": ["login-google-email", "recuperar-senha"],
  "AUTH-002": ["confirmar-email", "criar-conta"],
  "AUTH-003": ["login-google-email", "problemas-de-acesso"],
  "AUTH-004": ["criar-conta", "seguranca-da-conta"],
  "AUTH-005": ["problemas-de-acesso", "login-google-email"],
  "AUTH-006": ["recuperar-senha", "confirmar-email"],
  "AUTH-007": ["problemas-de-acesso", "recuperar-senha"],
  "AUTH-008": ["login-google-email", "recuperar-senha"],
  "DB-002": ["gerenciar-apresentacoes-dashboard", "lixeira"],
  "DB-003": ["limites-de-uso"],
  "EDIT-001": ["salvamento-e-desfazer", "editar-slide"],
  "EDIT-002": ["editar-com-ia-chat", "limites-de-uso"],
  "EXP-001": ["resolver-falha-na-exportacao", "exportar-pdf-pptx"],
  "EXP-002": ["pptx-diferente-do-editor", "exportar-pdf-pptx"],
  "GEN-001": ["creditos-consumo", "limites-de-uso"],
  "GEN-002": ["planos-e-precos", "custo-por-apresentacao"],
  "GEN-003": ["geracao-lenta"],
  "GEN-004": ["escolher-numero-de-slides", "escrever-bom-prompt"],
  "GEN-005": ["limites-de-uso"],
  "GEN-006": ["geracao-lenta", "creditos-devolvidos"],
  "GEN-007": ["conteudo-recusado", "escrever-bom-prompt"],
  "GEN-008": ["geracao-lenta", "creditos-devolvidos"],
  "IMG-001": ["problemas-imagem", "trocar-imagem"],
  "IMG-002": ["trocar-imagem", "imagens-ia-vs-pexels"],
  "INT-001": ["problemas-imagem", "trocar-imagem"],
  "INT-002": ["editar-com-ia-chat", "diagnostico-de-conexao"],
  "NET-001": ["diagnostico-de-conexao", "navegadores-suportados"],
  "PAY-001": ["pagamento-aprovado-nao-liberou"],
  "PAY-002": ["pagamento-aprovado-nao-liberou"],
  "PAY-003": ["pagamento-aprovado-nao-liberou", "formas-de-pagamento"],
  "PAY-004": ["pagamento-aprovado-nao-liberou", "creditos-consumo"],
  "PAY-005": ["cancelar-assinatura", "assinatura-encerrada"],
  "SUP-001": ["falar-com-humano", "historico-de-suporte"],
  "SUP-002": ["falar-com-humano", "codigos-de-erro"],
  "SUP-003": ["falar-com-humano"],
  "SUP-999": ["codigos-de-erro", "falar-com-humano"],
  "UI-001": ["diagnostico-de-conexao", "navegadores-suportados"],
  "UI-002": ["diagnostico-de-conexao"],
  "UI-003": ["resolver-falha-na-exportacao", "exportar-pdf-pptx"],
  "UI-004": ["resolver-falha-na-exportacao", "pptx-diferente-do-editor"],
  "VIEW-001": ["compartilhar-apresentacao", "publicar-e-despublicar"],
  "VIEW-002": ["publicar-e-despublicar", "compartilhar-apresentacao"],
};

/** Textos do catálogo de erros que mudaram junto com o produto. */
export const ERROR_TEXT_FIXES: Record<string, string> = {
  "AUTH-004": "A senha precisa ter ao menos 8 caracteres.",
  "VIEW-001": "Esta apresentação não está disponível: ela é privada ou foi despublicada pelo autor.",
};

// Raiz do repositório a partir do caminho deste arquivo (o URL global do
// jsdom, no vitest, não é aceito por fileURLToPath — por isso a string).
const ROOT = import.meta.url.startsWith("file:") ? resolve(dirname(fileURLToPath(import.meta.url)), "..") : process.cwd();
export const ARTICLES_DIR = join(ROOT, "docs/central-de-ajuda/artigos");
export const MIGRATION_FILES = [
  join(ROOT, "supabase/migrations/20260927000300_help_center_content.sql"),
  join(ROOT, "drizzle/migrations/0004_help_center_content.sql"),
];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : name.endsWith(".md") ? [full] : [];
  });

export function parseArticle(raw: string, file: string): HelpArticleSource {
  const m = raw.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: cabeçalho --- ausente`);
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const value = line.slice(i + 1).trim();
    // Aspas opcionais, para títulos com dois-pontos.
    meta[line.slice(0, i).trim()] = /^".*"$/.test(value) ? value.slice(1, -1) : value;
  }
  for (const key of ["slug", "title", "category", "keywords"]) {
    if (!meta[key]) throw new Error(`${file}: campo "${key}" ausente`);
  }
  return {
    slug: meta.slug,
    title: meta.title,
    category: meta.category,
    keywords: meta.keywords.split(",").map((k) => k.trim()).filter(Boolean),
    content: m[2].trim() + "\n",
    file,
  };
}

export function loadArticles(dir: string = ARTICLES_DIR): HelpArticleSource[] {
  const articles = walk(dir).sort().map((f) => parseArticle(readFileSync(f, "utf8"), relative(ROOT, f)));
  const seen = new Set<string>();
  for (const a of articles) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.slug)) throw new Error(`${a.file}: slug inválido "${a.slug}"`);
    if (seen.has(a.slug)) throw new Error(`${a.file}: slug duplicado "${a.slug}"`);
    seen.add(a.slug);
    if (!(HELP_CATEGORIES as readonly string[]).includes(a.category)) throw new Error(`${a.file}: categoria desconhecida "${a.category}"`);
    if (a.title.length > 90) throw new Error(`${a.file}: título com mais de 90 caracteres`);
    if (!a.file.includes(`/${a.category}/`)) throw new Error(`${a.file}: arquivo fora da pasta da categoria "${a.category}"`);
    if (RETIRED_SLUGS.includes(a.slug)) throw new Error(`${a.file}: slug está na lista de aposentados`);
  }
  return articles;
}

/** Links internos /ajuda/<slug> citados nos artigos. */
export const internalLinks = (a: HelpArticleSource): string[] =>
  Array.from(a.content.matchAll(/\]\(\/ajuda\/([a-z0-9-]+)\)/g), (m) => m[1]);

// Dollar-quoting com etiqueta que nunca aparece no texto.
const dq = (s: string): string => {
  let tag = "ha";
  while (s.includes(`$${tag}$`)) tag += "x";
  return `$${tag}$${s}$${tag}$`;
};
const sqlArray = (xs: string[]) => `ARRAY[${xs.map(dq).join(", ")}]::text[]`;

export function buildSql(articles: HelpArticleSource[]): string {
  const lines: string[] = [
    "-- GERADO por scripts/help-center.ts a partir de docs/central-de-ajuda/artigos.",
    "-- Não edite à mão: altere os arquivos .md e rode",
    "--   node --experimental-strip-types scripts/help-center.ts",
    "--",
    "-- Publica a Central de Ajuda revisada (upsert por slug), retira artigos",
    "-- fundidos em outros e corrige os links do catálogo de erros. Idempotente.",
    "",
  ];
  for (const a of articles) {
    lines.push(
      `INSERT INTO public.help_articles (slug, title, category, content_md, keywords, is_published)`,
      `VALUES (${dq(a.slug)}, ${dq(a.title)}, ${dq(a.category)}, ${dq(a.content)}, ${sqlArray(a.keywords)}, true)`,
      `ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, content_md = EXCLUDED.content_md,`,
      `  keywords = EXCLUDED.keywords, is_published = true, updated_at = now();`,
      "",
    );
  }
  if (RETIRED_SLUGS.length) {
    lines.push(
      `UPDATE public.help_articles SET is_published = false, updated_at = now() WHERE slug IN (${RETIRED_SLUGS.map(dq).join(", ")});`,
      "",
    );
  }
  for (const [code, slugs] of Object.entries(ERROR_ARTICLE_LINKS)) {
    lines.push(`UPDATE public.error_catalog SET related_articles = ${sqlArray(slugs)} WHERE code = ${dq(code)};`);
  }
  lines.push("");
  for (const [code, text] of Object.entries(ERROR_TEXT_FIXES)) {
    lines.push(`UPDATE public.error_catalog SET user_description = ${dq(text)} WHERE code = ${dq(code)} AND user_description IS DISTINCT FROM ${dq(text)};`);
  }
  return lines.join("\n") + "\n";
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(ROOT, "scripts/help-center.ts");
if (isMain) {
  const articles = loadArticles();
  const slugs = new Set(articles.map((a) => a.slug));
  const broken = articles.flatMap((a) => internalLinks(a).filter((s) => !slugs.has(s)).map((s) => `${a.file} → /ajuda/${s}`));
  const brokenCatalog = Object.entries(ERROR_ARTICLE_LINKS).flatMap(([c, xs]) => xs.filter((s) => !slugs.has(s)).map((s) => `${c} → ${s}`));
  if (broken.length || brokenCatalog.length) {
    console.error("Links quebrados:\n" + [...broken, ...brokenCatalog].join("\n"));
    process.exit(1);
  }
  const sql = buildSql(articles);
  for (const f of MIGRATION_FILES) writeFileSync(f, sql);
  const byCat = HELP_CATEGORIES.map((c) => `${c}: ${articles.filter((a) => a.category === c).length}`).join(", ");
  console.log(`${articles.length} artigos (${byCat}) → ${MIGRATION_FILES.map((f) => relative(ROOT, f)).join(", ")}`);
}
