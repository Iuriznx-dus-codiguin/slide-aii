# Central de Ajuda — como editar

Os artigos publicados em `/ajuda` ficam na tabela `help_articles`, mas a **fonte** são os arquivos Markdown desta pasta. O conteúdo fica versionado, revisado em PR e testado.

## Estrutura

```
docs/central-de-ajuda/artigos/<categoria>/<slug>.md
```

```markdown
---
slug: cancelar-assinatura
title: Cancelar a assinatura
category: planos
keywords: cancelar, cancelamento, assinatura
---
Texto em Markdown (tabelas, listas e links são suportados).
```

- **Categorias:** `comecar`, `geracao`, `editor`, `apresentacao`, `exportacao`, `planos`, `conta`, `privacidade`, `autenticacao`, `suporte`. Os rótulos exibidos ficam em `src/lib/helpCategories.ts`.
- **Links entre artigos:** use `[texto](/ajuda/<slug>)`. Links para os documentos legais: `/termos#<seção>` e `/privacidade#<seção>`.
- **Títulos com dois-pontos:** coloque o título entre aspas.
- **Slugs são permanentes:** o catálogo de erros, o assistente de suporte e links externos apontam para eles. Para retirar um artigo, inclua o slug em `RETIRED_SLUGS` (`scripts/help-center.ts`).

## Publicar

```sh
node --experimental-strip-types scripts/help-center.ts
```

O script valida os arquivos (slug, categoria, links internos, links do catálogo de erros) e regenera as migrações `supabase/migrations/20260927000300_help_center_content.sql` e `drizzle/migrations/0004_help_center_content.sql`. Para uma nova rodada de conteúdo, crie uma nova migração com o mesmo gerador. O teste `src/test/helpCenterContent.test.ts` falha se a migração estiver desatualizada.

## Guia de estilo

- Português do Brasil, frases curtas, segunda pessoa ("você").
- Comece pelo que o usuário quer fazer; passos numerados; tabelas para comparar.
- **Valores precisos:** preços, custos e limites têm de bater com `src/lib/cakto.ts`, `src/lib/fairUse.ts` e os Termos de Uso. Na dúvida, confira no código.
- Nunca prometa um recurso que não existe.
- Termine com "Relacionados" (2 ou 3 links).

## Catálogo de erros

`ERROR_ARTICLE_LINKS` (em `scripts/help-center.ts`) define os artigos sugeridos para cada código de erro, no painel de suporte e nas páginas de artigo.
