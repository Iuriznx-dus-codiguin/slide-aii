# Documentos legais

| Documento | Rota | Fonte |
| --- | --- | --- |
| Termos de Uso | `/termos` | `src/pages/Terms.tsx` |
| Política de Privacidade (inclui cookies) | `/privacidade` (`/cookies` redireciona) | `src/pages/Privacy.tsx` |
| Resumo do contrato no checkout | Janela de pagamento | `src/components/legal/ContractSummary.tsx` |
| Dados do fornecedor, e-mails e versões | — | `src/lib/legal.ts` |

Os números citados (custos, preços, limites) vêm das mesmas constantes usadas na cobrança (`src/lib/cakto.ts`, `src/lib/fairUse.ts`), para os documentos não ficarem desatualizados.

## ⚠️ Pendências antes de abrir vendas

1. **Preencher os dados do fornecedor** em `src/lib/legal.ts`: `legalName` (razão social), `taxId` (CNPJ ou CPF), `address` (endereço completo) e `seatCity`. É exigência do Decreto 7.962/2013, art. 2º. Campos vazios não aparecem nas páginas, mas a obrigação continua.
2. **Confirmar que a caixa `suporte@slideai.com.br` existe e é monitorada.** Ela é o canal de atendimento, de cancelamento, de arrependimento e do titular de dados. Se houver um e-mail específico de privacidade, troque `privacyEmail`.
3. **Encarregado (DPO):** preencher `dpoName`, ou manter só o canal do titular se o negócio se enquadrar como agente de pequeno porte (Resolução CD/ANPD nº 2/2022).
4. **Revisão por advogado.** Os textos foram escritos com base na LGPD, no CDC, no Marco Civil da Internet e no Decreto 7.962/2013 e refletem o comportamento real da plataforma. Recomenda-se revisão jurídica, em especial das seções 7, 8, 9 e 18 dos Termos.
5. **Nota fiscal:** confirmar como ela é emitida (própria ou pela Cakto) e ajustar a cláusula 6.9 e o artigo `nota-fiscal`, se necessário.
6. **Arquivar os DPAs** (acordos de tratamento de dados) de Lovable/Supabase, OpenAI, Google e Cakto.

## Compromissos assumidos nos Termos

Estes compromissos precisam ser cumpridos na operação:

- Cancelamento sem multa, com acesso até o fim do período pago (implementado em `can_user_generate`).
- Arrependimento em 7 dias com reembolso integral (processar pela Cakto; o webhook estorna os créditos).
- Aviso de 30 dias para reajuste de preço, aumento da tabela de custos ou redução de limites.
- Aviso de 15 dias para mudanças relevantes nos Termos, com novo aceite quando necessário.
- Aviso de 30 dias e reembolso proporcional se o serviço for encerrado.
- Resposta ao atendimento em até 1 dia útil (limite legal: 5 dias).
- Comunicações de relacionamento com descadastro em um clique e no máximo uma por dia (Termos 20.2–20.3; versão 2026-10-04).
- Devolução automática de créditos de gerações que travaram, em até 15 minutos ([runbook](../operacao/runbooks.md#créditos-de-geração-que-travou)).

## Como publicar uma nova versão

1. Edite `Terms.tsx` e/ou `Privacy.tsx`.
2. Atualize `termsVersion` e/ou `privacyVersion` (formato `AAAA-MM-DD`) e `effectiveDateLabel` em `src/lib/legal.ts`.
3. Mudança relevante: avise os usuários por e-mail com 15 dias de antecedência. Ao publicar, o `LegalConsentGate` pede o novo aceite no próximo acesso.
4. Atualize os artigos da categoria `privacidade` e o [registro de operações](../lgpd/registro-de-operacoes.md), se aplicável.

## Prova do aceite

```sql
select accepted_at, terms_version, privacy_version, source, ip, user_agent
from legal_acceptances where user_id = '<USER_ID>' order by accepted_at;
```
