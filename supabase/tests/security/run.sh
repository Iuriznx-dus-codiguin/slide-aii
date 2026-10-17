#!/bin/bash
# Testes de segurança do banco num Postgres local (não toca no projeto real).
#
# Uso (PGHOST/PGPORT/PGUSER apontando para um Postgres 15+ descartável):
#   supabase/tests/security/run.sh           # com a 0010: exploits bloqueados + regressão + atualização
#   supabase/tests/security/run.sh --before  # sem a 0010: mostra cada exploit funcionando
#
# Cria e recria os bancos slideai_sec_* no servidor indicado.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
PSQL=(psql -v ON_ERROR_STOP=1 -q)

# build_db <nome> <com_0010: yes|no>
build_db() {
  local db="$1" with_new="$2" f
  "${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $db" -c "CREATE DATABASE $db" >/dev/null
  "${PSQL[@]}" -d "$db" -f "$HERE/00_supabase_stub.sql" >/dev/null 2>&1
  # Histórico real: supabase/migrations até 2026-09-11; depois, as do drizzle
  # (as que a Lovable Cloud aplica).
  for f in $(ls "$REPO"/supabase/migrations/*.sql | sort); do
    [[ "$(basename "$f")" > "20260920" ]] && continue
    "${PSQL[@]}" -d "$db" -f "$f" >/dev/null 2>&1 || { echo "migração falhou: $f"; exit 1; }
  done
  for f in $(ls "$REPO"/drizzle/migrations/*.sql | sort); do
    [[ "$(basename "$f")" == 0010_* && "$with_new" == "no" ]] && continue
    "${PSQL[@]}" -d "$db" -f "$f" >/dev/null 2>&1 || { echo "migração falhou: $f"; exit 1; }
  done
  "${PSQL[@]}" -d "$db" -f "$HERE/seed.sql" >/dev/null 2>&1
}

if [[ "${1:-}" == "--before" ]]; then
  build_db slideai_sec_before no
  psql -q -d slideai_sec_before -f "$HERE/exploits_before_fix.sql"
  exit 0
fi

build_db slideai_sec_exploits yes
# A 0010 tem de ser idempotente: aplicar de novo não pode falhar.
"${PSQL[@]}" -d slideai_sec_exploits -f "$REPO/drizzle/migrations/0010_security_hardening.sql" >/dev/null 2>&1
"${PSQL[@]}" -d slideai_sec_exploits -f "$HERE/exploits.sql" 2>&1 | grep -E "bloqueado|EXPLOIT|ERROR" | sed -E 's/.*(NOTICE|ERROR):  //'

build_db slideai_sec_regression yes
"${PSQL[@]}" -d slideai_sec_regression -f "$HERE/regression.sql" 2>&1 | grep -E "ok:|FALHOU|ERROR|REGRESSAO" | sed -E 's/.*(NOTICE|ERROR):  //'

# Banco que já tinha dados gravados pelos buracos antigos, depois atualizado.
build_db slideai_sec_upgrade no
"${PSQL[@]}" -d slideai_sec_upgrade -f "$HERE/upgrade_before.sql" >/dev/null
"${PSQL[@]}" -d slideai_sec_upgrade -f "$REPO/drizzle/migrations/0010_security_hardening.sql" >/dev/null 2>&1
"${PSQL[@]}" -d slideai_sec_upgrade -f "$HERE/upgrade.sql" 2>&1 | grep -E "ok:|FALHOU|ERROR|ATUALIZACAO" | sed -E 's/.*(NOTICE|ERROR):  //'
echo "SEGURANCA DO BANCO OK"
