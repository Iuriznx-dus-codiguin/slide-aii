# Atendimento ao titular de dados (LGPD, art. 18)

Canal: `LEGAL.privacyEmail` (hoje suporte@slideai.com.br) ou chat de suporte.

## Prazos

| Pedido | Prazo |
| --- | --- |
| Confirmação de tratamento e acesso em formato simplificado | Imediato |
| Declaração completa (origem, critérios, finalidade) | Até 15 dias (art. 19, II) |
| Correção, exclusão, portabilidade, oposição, revisão de decisão automatizada | O quanto antes; referência interna de 15 dias |

## 1. Verificar a identidade

- O pedido deve vir do e-mail da conta. Se não vier, responda pedindo que escreva a partir dele.
- Nunca peça senha ou documentos desnecessários.
- Pedidos de responsáveis por menores: confirme o vínculo de forma proporcional.

Registre o pedido (data, tipo, conta) numa planilha interna de atendimentos.

## 2. Localizar a conta

```sql
select id, email, plan, created_at from auth.users where lower(email) = lower('email@exemplo.com');
```

## 3. Acesso e portabilidade (exportação)

Rode no SQL editor (service role) e envie o JSON ao titular:

```sql
with u as (select '<USER_ID>'::uuid as id)
select jsonb_pretty(jsonb_build_object(
  'perfil',        (select to_jsonb(p) - 'cakto_customer_id' - 'cakto_subscription_id' from profiles p, u where p.id = u.id),
  'apresentacoes', (select coalesce(jsonb_agg(to_jsonb(x) - 'creative_brief' - 'dynamic_theme'), '[]') from presentations x, u where x.user_id = u.id),
  'slides',        (select coalesce(jsonb_agg(jsonb_build_object('presentation_id', s.presentation_id, 'position', s.position, 'content', s.content, 'speaker_notes', s.speaker_notes)), '[]')
                      from slides s join presentations x on x.id = s.presentation_id, u where x.user_id = u.id),
  'creditos',      (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]') from credit_transactions t, u where t.user_id = u.id),
  'pagamentos',    (select coalesce(jsonb_agg(jsonb_build_object('data', e.created_at, 'evento', e.event_type, 'pedido', e.cakto_id)), '[]') from payment_events e, u where e.user_id = u.id),
  'suporte',       (select coalesce(jsonb_agg(jsonb_build_object('ticket', c.ticket_id, 'assunto', c.subject, 'criado', c.created_at,
                      'mensagens', (select jsonb_agg(jsonb_build_object('papel', m.role, 'texto', m.content, 'data', m.created_at) order by m.created_at) from support_messages m where m.conversation_id = c.id))), '[]')
                      from support_conversations c, u where c.user_id = u.id),
  'acessos',       (select coalesce(jsonb_agg(jsonb_build_object('data', a.created_at, 'ip', a.ip, 'navegador', a.user_agent) order by a.created_at), '[]') from access_logs a, u where a.user_id = u.id),
  'aceites',       (select coalesce(jsonb_agg(to_jsonb(l) order by l.accepted_at), '[]') from legal_acceptances l, u where l.user_id = u.id)
));
```

As apresentações também podem ser exportadas pelo próprio usuário (PowerPoint/PDF).

## 4. Correção

A maior parte é autoatendimento em **Perfil → Dados**. Para o e-mail de login, altere pelo painel de Autenticação da Lovable Cloud.

## 5. Exclusão da conta

Antes, confirme com o titular que a assinatura foi cancelada na Cakto e que ele exportou o que queria.

```sql
-- 1) Dados sem cascata para auth.users
delete from generation_logs where user_id = '<USER_ID>';
delete from security_events where user_id = '<USER_ID>';
update error_occurrences set user_id = null where user_id = '<USER_ID>';
```

2. Apague os arquivos do usuário no Storage: buckets `avatars/<USER_ID>/` e `slide-images/<USER_ID>/`.
3. Exclua o usuário em **Lovable Cloud → Authentication → Users** (ou `delete from auth.users where id = '<USER_ID>';`). A exclusão em cascata remove perfil, apresentações, slides, visitas, ativos, extrato de créditos, suporte, papéis e pedidos de acesso.

**Mantidos por obrigação legal** (informe ao titular): `payment_events` (5 anos), `access_logs` (6 meses), `legal_acceptances` (até 5 anos). A rotina de retenção elimina cada um no fim do prazo.

Responda ao titular confirmando a exclusão e listando o que foi mantido e até quando.

## 6. Oposição e revisão de decisão automatizada

- **Oposição a legítimo interesse** (logs de diagnóstico, segurança): avalie. Registros de segurança podem ser mantidos se necessários à prevenção de fraude, com justificativa ao titular.
- **Revisão de decisão automatizada** (bloqueio por limite, triagem do suporte): uma pessoa da equipe revisa o caso e responde com o resultado.

## 7. Denúncias e remoção de conteúdo

Veja a seção 14 dos Termos. Para despublicar uma apresentação: `update presentations set is_published = false where slug = '<slug>';`. Registre o motivo e avise o autor.
