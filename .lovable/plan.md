## Objetivo
Registrar a migration `20260702140000_a2d1e808-0416-4e57-a7ec-e37089f5b302` como aplicada em `supabase_migrations.schema_migrations`, sem re-rodar SQL nenhum (os objetos já existem no banco).

## Passo único
Inserir a linha faltante via `supabase--insert`:

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260702140000', '20260702140000_a2d1e808-0416-4e57-a7ec-e37089f5b302', ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;
```

- `version` segue o padrão das outras linhas (timestamp compacto, sem sufixo hash).
- `name` usa o mesmo formato das migrations recentes que têm nome preenchido.
- `statements = ARRAY[]::text[]` porque o SQL já foi executado fora do tracker — nada precisa rodar.
- `ON CONFLICT DO NOTHING` para ser idempotente caso já exista.

## Validação
Depois do insert, rodar uma `read_query` confirmando que a linha `20260702140000` aparece em `schema_migrations`.

## O que NÃO faz parte deste plano
- Não altera schema, policies, funções ou triggers — todos os objetos da migration já foram verificados como presentes.
- Não mexe em código da aplicação nem em edge functions.
