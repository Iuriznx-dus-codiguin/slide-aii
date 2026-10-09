# Auditoria de segurança (09/10/2026)

Auditoria de cinco categorias: isolamento por dono (RLS), permissão decidida no navegador, IDOR, chaves expostas e XSS. Cobre o commit `4890504`, o histórico git completo e o banco de produção (somente leitura).

| Arquivo | O que é |
| --- | --- |
| `relatorio-auditoria-seguranca.pdf` | Relatório completo: capa, metodologia, resumo com gráficos, pontos fortes e fracos, achados por categoria, recomendações e issues para o GitHub |
| `issues-github.md` | As mesmas issues do PDF, sem quebras de linha, para copiar e colar no GitHub |
| `dados_auditoria.py` | Fonte única dos dados: achados, evidências, pontos fortes, recomendações e issues |
| `gerar_relatorio.py` | Gera o PDF e o `issues-github.md` a partir dos dados |
| `requirements.txt` | Dependências do gerador |

## Regerar o relatório

Use um ambiente isolado; nada é instalado globalmente:

```bash
cd docs/security-audit
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python gerar_relatorio.py
```

O gerador usa as fontes Liberation Sans e DejaVu Sans Mono (pacotes `fonts-liberation` e `fonts-dejavu`). Sem elas, usa Helvetica e Courier, que não têm alguns símbolos.

Para atualizar o relatório depois das correções, edite `dados_auditoria.py` e rode o gerador de novo.

## Regras de sigilo

Valores de segredos nunca entram nestes arquivos. Quando é preciso comparar, usa-se a impressão SHA-256 truncada em 12 caracteres, o mesmo formato que o `cakto-webhook` registra em `security_events`.
