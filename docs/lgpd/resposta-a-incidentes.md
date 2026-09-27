# Plano de resposta a incidentes de segurança

Base: LGPD, art. 48, e Resolução CD/ANPD nº 15/2024 (comunicação de incidente de segurança).

## O que é um incidente

Qualquer evento que comprometa a confidencialidade, a integridade ou a disponibilidade de dados pessoais. Exemplos: vazamento de chave de serviço (`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`), falha de RLS que expõe dados de outra conta, acesso indevido a uma conta de equipe, perda de dados.

## Papéis

- **Responsável pelo incidente:** o encarregado (ou o sócio responsável, se não houver encarregado).
- **Técnico:** quem mantém a plataforma.

## Passo a passo

1. **Conter (imediato).**
   - Revogue e rotacione chaves expostas (Lovable Cloud → Secrets; chaves dos provedores).
   - Corrija a política de RLS ou a função afetada, ou desative a funcionalidade.
   - Encerre sessões suspeitas; bloqueie contas comprometidas.
2. **Avaliar (até 24 h).**
   - Quais dados, quantos titulares, desde quando?
   - Fontes: `security_events`, `access_logs`, logs das edge functions e do banco.
   - Há risco ou dano relevante? Considere dados financeiros, de menores, credenciais, volume e possibilidade de uso malicioso.
3. **Comunicar (se houver risco ou dano relevante).**
   - **ANPD:** em até **3 dias úteis** do conhecimento do incidente, pelo formulário no site da ANPD.
   - **Titulares:** no mesmo prazo, com linguagem clara: o que aconteceu, quais dados, riscos, medidas tomadas e o que o titular pode fazer.
   - Conteúdo mínimo: natureza dos dados, titulares envolvidos, medidas de segurança, riscos, motivos de eventual demora e medidas para reverter ou mitigar.
4. **Registrar.** Mesmo sem comunicação obrigatória, registre o incidente (data, descrição, dados, avaliação de risco, medidas) e guarde por pelo menos 5 anos.
5. **Aprender.** Faça uma revisão pós-incidente e corrija a causa raiz.

## Contatos

- Suporte da Lovable (infraestrutura) e dos provedores de IA, se as chaves forem afetadas.
- Cakto, se envolver dados de pagamento.
