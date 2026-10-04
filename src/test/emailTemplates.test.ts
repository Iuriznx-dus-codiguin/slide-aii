import { describe, expect, it } from "vitest";
import { buildEmail, renderEmail, SITE_URL } from "../../supabase/functions/_shared/emailTemplates.ts";
import { SAMPLE_EMAILS } from "../../scripts/email-preview.ts";

// Modelos dos e-mails (supabase/functions/_shared/emailTemplates.ts). Estes
// testes garantem que todo modelo renderiza, que conteúdo do usuário nunca
// vira HTML e que a versão em texto acompanha a HTML.
describe("e-mails da plataforma", () => {
  it.each(Object.entries(SAMPLE_EMAILS))("%s renderiza HTML e texto", (_name, event) => {
    const { subject, html, text } = renderEmail(event);
    expect(subject.length).toBeGreaterThan(5);
    expect(subject.length).toBeLessThanOrEqual(90);
    expect(html).toContain('<html lang="pt-BR"');
    expect(html).toContain(`${SITE_URL}/email-logo.png`);
    expect(text).not.toMatch(/<[a-z][^>]*>/i);
    const c = buildEmail(event);
    expect(text).toContain(c.title);
    if (c.cta) {
      expect(c.cta.url.startsWith(`${SITE_URL}/`)).toBe(true);
      expect(text).toContain(c.cta.url);
    }
  });

  it("conteúdo vindo do usuário é escapado", () => {
    const evil = `<img src=x onerror=alert(1)> **x**`;
    for (const event of [
      { type: "access_requested", requesterName: evil, message: evil },
      { type: "support_reply", ticketId: "SUP-1", reply: evil, resolved: false },
      { type: "ticket_opened", ticketId: "SUP-1", subject: evil },
      { type: "welcome", name: evil },
    ] as const) {
      const { html } = renderEmail(event);
      expect(html).not.toContain("<img src=x");
      expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    }
  });

  it("chamados apontam para a conversa quando o id é conhecido", () => {
    const c = buildEmail({ type: "ticket_escalated", ticketId: "SUP-9", conversationId: "abc" });
    expect(c.cta?.url).toBe(`${SITE_URL}/suporte/abc`);
    expect(buildEmail({ type: "ticket_escalated", ticketId: "SUP-9" }).cta?.url).toBe(`${SITE_URL}/suporte`);
  });

  it("alerta interno não leva o rodapé público", () => {
    const { html } = renderEmail(SAMPLE_EMAILS["alerta-operacao"]);
    expect(html).not.toContain("Central de Ajuda");
    expect(html).toContain("Atenção");
  });
});
