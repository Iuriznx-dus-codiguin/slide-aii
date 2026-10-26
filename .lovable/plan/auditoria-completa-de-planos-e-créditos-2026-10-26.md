# Auditoria completa de planos e créditos

Objetivo: confirmar que preços, créditos, bônus, links de pagamento e regras de uso estão iguais em todos os lugares — site, tela de geração, pagamento, servidor, banco e e-mails — e listar qualquer divergência encontrada.

## O que será verificado

1. **Tabela única de referência** — montar a tabela oficial (planos, preços, créditos por mês, bônus de primeira ativação, custo por slide/profundidade/falas, limite MAX de uso justo, links Cakto) a partir do código do servidor e comparar com:
   - página inicial (cards de preço, estimativa "≈ apresentações", FAQ);
   - tela de pagamento após configurar a apresentação;
   - painel de conta e saldo;
   - Termos de Uso e Central de Ajuda;
   - modelos de e-mail de planos/renovação.
2. **Banco de dados (somente leitura)** — conferir se a migração de preços de outubro foi aplicada, funções de débito, bônus único, estorno e renovação mensal, permissões e a regra de saldo vigente.
3. **Pagamento Cakto** — conferir que cada oferta (único, mensal, trimestral, anual, MAX) cai no plano e créditos corretos, bônus concedido uma só vez, cancelamento/reembolso removem o que devem, e histórico de eventos recentes sem falhas.
4. **Geração** — custo calculado igual na tela e no servidor; aviso e botão ("Gerar" x "Continuar para pagamento") conforme o saldo; estorno quando a geração falha.
5. **Testes automáticos** — rodar os testes existentes de planos, créditos e webhook; acrescentar teste apenas se faltar cobertura de uma regra de preço.
6. **Dados reais** — consulta somente leitura procurando contas com saldo incoerente (bônus duplicado, créditos mensais sem assinatura ativa, estornos falhos).

## Entrega

Relatório com: OK por item, divergências encontradas (onde aparece, valor esperado x valor atual, gravidade) e proposta de correção. Nenhuma correção sem sua aprovação, nenhuma compra, alteração de saldo ou geração cobrada.

## Detalhes técnicos

Fontes: `supabase/functions/_shared/plans.ts`, `src/lib/cakto.ts`, `src/lib/entitlement.ts`, `src/lib/fairUse.ts`, `Pricing.tsx`, `PaymentGate.tsx`, `CreditsPanel.tsx`, `AccountPanel.tsx`, `Generate.tsx`, `faqContent.ts`, `Terms.tsx`, `cakto-webhook`, `generate-presentation`, `lifecycleTemplates.ts`, MCP `get-credit-balance`, migração `20261024000100_plan_pricing_2026_10.sql`, testes `plansParity`, `entitlement`, `caktoWebhook`.
