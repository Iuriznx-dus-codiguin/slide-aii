# Testes de segurança do banco

Reproduzem, num Postgres local e descartável, os exploits da [auditoria de 11/10/2026](../../../docs/revisao/2026-10-11-auditoria-de-seguranca.md) e conferem que os fluxos legítimos continuam funcionando depois da migração `0010_security_hardening`. Não tocam no projeto da Lovable Cloud.

| Arquivo | Papel |
| --- | --- |
| `00_supabase_stub.sql` | Imita o mínimo do Supabase: papéis `anon`/`authenticated`/`service_role`, `auth.uid()`/`auth.role()` lidos de `request.jwt.claims`, `storage`, `vault` |
| `seed.sql` | Duas contas (vítima e atacante) e um deck gravado como o servidor gravava |
| `exploits_before_fix.sql` | Roteiro dos exploits, sem asserções (para ver cada um funcionar sem a 0010) |
| `exploits.sql` | Os mesmos exploits com asserção: cada um precisa falhar |
| `regression.sql` | Fluxos legítimos: perfil, Editor, painel, link público, portfólio, suporte, cotas, webhook, rotinas sem JWT |
| `run.sh` | Monta os bancos com o histórico real de migrações e roda tudo |

## Como rodar

Requer PostgreSQL 15+ (com `pgcrypto`) e um superusuário:

```sh
PGHOST=/tmp PGPORT=5432 PGUSER=postgres supabase/tests/security/run.sh          # com a 0010
PGHOST=/tmp PGPORT=5432 PGUSER=postgres supabase/tests/security/run.sh --before # sem a 0010
```

O script recria os bancos `slideai_sec_*` no servidor indicado. A saída esperada termina em `EXPLOITS BLOQUEADOS`, `REGRESSAO OK` e `SEGURANCA DO BANCO OK`; qualquer `EXPLOIT PASSOU` ou `FALHOU` encerra com erro.

## Limites

O stub não reproduz tudo do Supabase: PostgREST (filtros, embeds), Realtime, GoTrue, pg_cron/pg_net e a configuração real dos buckets ficam de fora. Políticas e gatilhos, sim, rodam no Postgres de verdade, com os mesmos papéis.
