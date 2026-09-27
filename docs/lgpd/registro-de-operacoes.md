# Registro das operações de tratamento de dados pessoais

Exigido pela LGPD (art. 37). Controlador: o operador do SlideAI (dados em `src/lib/legal.ts`). Última revisão: 27/09/2026.

Mantenha este registro alinhado com a [Política de Privacidade](../../src/pages/Privacy.tsx). Qualquer nova coleta, finalidade, fornecedor ou mudança de prazo exige atualizar os dois e a versão da Política (`LEGAL.privacyVersion`).

| # | Operação | Titulares | Dados | Finalidade | Base legal | Onde | Compartilhamento | Retenção |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Cadastro e autenticação | Usuários | Nome, e-mail, hash da senha, foto e nome do Google, perfil de uso | Conta e login | Contrato (7º, V) | `auth.users`, `profiles` | Lovable Cloud/Supabase; Google (login) | Enquanto a conta existir |
| 2 | Perfil público | Usuários que ativam | Usuário, bio, site, localização, redes, foto; pedidos de acesso | Portfólio | Contrato (7º, V) | `profiles`, `profile_access_requests` | Público, se ativado | Enquanto a conta existir |
| 3 | Geração e edição | Usuários; terceiros citados no conteúdo | Tema, descrição, textos, falas, nomes de apresentadores | Prestar o serviço | Contrato (7º, V). Terceiros: o usuário é o controlador e o SlideAI é o operador | `presentations`, `slides`, `assets` | OpenAI, Google (Gemini), gateway Lovable; Pexels (só termos de busca) | Enquanto a conta existir |
| 4 | Pagamentos e créditos | Compradores | Plano, status, IDs Cakto, pedido (nome, e-mail, telefone, CPF/CNPJ, valor), extrato | Cobrança, liberação, reembolso, fiscal | Contrato, obrigação legal, exercício de direitos (7º, II, V e VI) | `payment_events`, `credit_transactions`, `profiles` | Cakto | Pedidos: 5 anos; extrato: enquanto a conta existir |
| 5 | Registros de acesso | Usuários | IP, data/hora, navegador | Marco Civil, art. 15 | Obrigação legal (7º, II) | `access_logs` | Nenhum (só mediante ordem judicial) | 6 meses (eliminação automática) |
| 6 | Aceite de documentos | Usuários | Versões, data/hora, IP, navegador | Prova da contratação | Contrato e exercício de direitos | `legal_acceptances` | Nenhum | Até 5 anos após o encerramento da conta |
| 7 | Suporte | Usuários | Mensagens, avaliação, códigos de erro | Atendimento | Contrato e legítimo interesse | `support_conversations`, `support_messages` | Provedor de IA (assistente); webhook de alerta interno (opcional) | Enquanto a conta existir |
| 8 | Diagnóstico e segurança | Usuários e visitantes | Erros (rota, código, trecho técnico, sessão), eventos de segurança com hash de IP, contadores de limite | Correção de falhas, antifraude | Legítimo interesse (7º, IX; 10) | `error_occurrences`, `security_events`, `edge_rate_limits` | Nenhum | 12 meses; limites: 2 dias |
| 9 | Telemetria de geração | Usuários | Título, tipo, modelo, custo, duração, créditos | Operação e estorno | Contrato e legítimo interesse | `generation_logs` | Nenhum | 12 meses |
| 10 | Visitas a apresentações publicadas | Espectadores | Data/hora e navegador (sem IP) | Contador de visualizações | Legítimo interesse | `slide_views` | Nenhum | 12 meses (o total fica em `view_count`) |
| 11 | Aplicativos conectados | Usuários que autorizam | Apresentações e saldo | Integração pedida pelo usuário | Contrato (7º, V) | OAuth + função `mcp` | Aplicativo autorizado | Até a revogação |
| 12 | Fontes tipográficas | Visitantes | IP e navegador (requisição) | Exibir o site | Legítimo interesse | — | Google Fonts | Conforme o Google |

## Transferência internacional

Operações 1, 3, 4, 7 e 12 envolvem fornecedores com servidores fora do Brasil (principalmente EUA). Bases: art. 33, IX (execução do contrato) e II (garantias contratuais dos fornecedores), observada a Resolução CD/ANPD nº 19/2024. **Ação pendente:** arquivar os termos de tratamento de dados (DPA) de Lovable/Supabase, OpenAI, Google e Cakto.

## Medidas de segurança

Veja [arquitetura.md](../arquitetura.md#segurança) e a seção 10 da Política de Privacidade.

## Legítimo interesse

Avaliação resumida das operações 7 a 10 e 12: a finalidade é legítima (segurança, correção de falhas, estatística ao autor), os dados são mínimos (hash de IP, sem IP nas visitas, remoção de dados sensíveis dos logs), o titular espera esse uso numa plataforma on-line e tem direito de oposição pelo canal do titular. Os prazos são curtos e a eliminação é automática.
