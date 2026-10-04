// Dados legais do SlideAI — fonte única para Termos de Uso, Política de
// Privacidade, rodapé, checkout e registro de aceite.
//
// ⚠️ ANTES DE ABRIR VENDAS, preencha os campos marcados com "PREENCHER".
// O Decreto 7.962/2013 (art. 2º) exige que o fornecedor que vende pela
// internet mostre, em local de destaque, nome empresarial, CNPJ (ou CPF) e
// endereço físico e eletrônico. Campos vazios simplesmente não aparecem nas
// páginas — nada de texto provisório no ar —, mas a obrigação continua.
//
// Versões: ao mudar o conteúdo dos Termos ou da Política de forma relevante,
// atualize a versão correspondente. Quem aceitou uma versão anterior verá o
// aviso de atualização no próximo acesso e precisará aceitar de novo
// (LegalConsentGate), e o aceite fica registrado em `legal_acceptances`.

export const LEGAL = {
  brand: "SlideAI",
  site: "https://slideai.com.br",

  /** PREENCHER: razão social (ex.: "Fulano Tecnologia Ltda."). */
  legalName: "",
  /** PREENCHER: CNPJ no formato 00.000.000/0000-00 (ou CPF, se pessoa física). */
  taxId: "",
  /** PREENCHER: endereço físico completo (logradouro, nº, bairro, cidade/UF, CEP). */
  address: "",
  /** PREENCHER: cidade/UF da sede — foro para relações que não são de consumo. */
  seatCity: "",

  /** Atendimento geral (Decreto 7.962/2013, art. 2º, II e art. 4º, V). */
  supportEmail: "suporte@slideai.com.br",
  /** Canal do titular de dados (LGPD, art. 18 e art. 41). */
  privacyEmail: "suporte@slideai.com.br",
  /**
   * PREENCHER (opcional): nome do encarregado pelo tratamento de dados (DPO).
   * Agentes de pequeno porte podem dispensá-lo (Resolução CD/ANPD nº 2/2022,
   * art. 11), desde que mantenham o canal acima; se houver, o nome deve ser
   * público (LGPD, art. 41, § 1º).
   */
  dpoName: "",

  /** Prazo de resposta do atendimento (o Decreto 7.962/2013 exige até 5 dias). */
  supportResponseTime: "até 1 dia útil",

  termsVersion: "2026-10-04",
  privacyVersion: "2026-10-04",
  /** Data exibida no topo dos documentos. */
  effectiveDateLabel: "4 de outubro de 2026",
} as const;

/** Linhas de identificação do fornecedor que estão preenchidas. */
export const supplierLines = (): string[] => {
  const lines: string[] = [];
  if (LEGAL.legalName) lines.push(LEGAL.legalName);
  if (LEGAL.taxId) lines.push(`CNPJ/CPF ${LEGAL.taxId}`);
  if (LEGAL.address) lines.push(LEGAL.address);
  return lines;
};

/** Nome de quem opera a plataforma, para frases como "o SlideAI, operado por…". */
export const operatorName = (): string => LEGAL.legalName || LEGAL.brand;

/** `true` quando os dados obrigatórios do fornecedor ainda não foram preenchidos. */
export const supplierDataMissing = (): boolean => !LEGAL.legalName || !LEGAL.taxId || !LEGAL.address;
