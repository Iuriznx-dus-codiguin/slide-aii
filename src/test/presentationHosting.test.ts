import { describe, expect, it } from "vitest";
import { deckHosting, HOSTING_GRACE_DAYS, SINGLE_HOSTING_MONTHS } from "@/lib/hosting";
import {
  extractStoragePaths, HOSTING_GRACE_DAYS as SERVER_GRACE_DAYS, SINGLE_HOSTING_MONTHS as SERVER_MONTHS,
} from "../../supabase/functions/_shared/hosting.ts";
import { shouldSend, type RuleContext } from "../../supabase/functions/_shared/lifecycleRules.ts";

// Hospedagem das apresentações (Termos, seção 12): sem plano ativo, as
// apresentações saem do ar; com créditos avulsos, ficam 3 meses; fora do ar,
// 30 dias para restaurar e depois exclusão.
const now = new Date("2026-11-10T12:00:00Z");
const day = 86_400_000;

describe("prazos", () => {
  it("créditos avulsos: 3 meses; restauração: 30 dias (app e servidor iguais)", () => {
    expect(SINGLE_HOSTING_MONTHS).toBe(3);
    expect(HOSTING_GRACE_DAYS).toBe(30);
    expect(SERVER_MONTHS).toBe(3);
    expect(SERVER_GRACE_DAYS).toBe(30);
  });
});

describe("deckHosting", () => {
  it("plano ativo mantém no ar mesmo sem prazo de créditos", () => {
    expect(deckHosting({ hosting_expires_at: null }, true, now).online).toBe(true);
  });
  it("sem plano, fica no ar até o fim do prazo dos créditos avulsos", () => {
    const h = deckHosting({ hosting_expires_at: new Date(now.getTime() + day).toISOString() }, false, now);
    expect(h.online).toBe(true);
    expect(h.expiresAt?.toISOString()).toBe(new Date(now.getTime() + day).toISOString());
  });
  it("sem plano e sem prazo: fora do ar, excluída 30 dias depois de sair", () => {
    const since = "2026-11-01T12:00:00Z";
    const h = deckHosting({ hosting_expires_at: null, offline_since: since }, false, now);
    expect(h.online).toBe(false);
    expect(h.purgeAt?.toISOString()).toBe("2026-12-01T12:00:00.000Z");
  });
  it("prazo de créditos vencido: fora do ar", () => {
    expect(deckHosting({ hosting_expires_at: new Date(now.getTime() - 1).toISOString() }, false, now).online).toBe(false);
  });
});

describe("imagens para excluir", () => {
  it("acha só arquivos do bucket de imagens, sem repetir", () => {
    const url = "https://x.supabase.co/storage/v1/object/sign/slide-images/0b7e2f6a-1111-4222-8333-444455556666/9a8b7c6d-1111-4222-8333-444455556666.webp?token=abc";
    const paths = extractStoragePaths([{ content: { image_url: url, other: url } }, { background_image_url: "https://images.pexels.com/1.jpg" }]);
    expect(paths).toEqual(["0b7e2f6a-1111-4222-8333-444455556666/9a8b7c6d-1111-4222-8333-444455556666.webp"]);
  });
});

describe("avisos de fora do ar", () => {
  const ctx = {
    firstName: null, persona: null, email: "a@b.com", plan: "single", subscriptionStatus: null, renewsAt: null,
    autoRenew: false, paymentMethod: null, cardBrand: null, cardLast4: null, nextPaymentDate: null, balance: 0,
    hasPurchased: true, generations: 1, billingAlert: null, lastPurchaseAt: null, relationshipAllowed: true, internal: false,
  } as RuleContext;
  it("não envia se as apresentações já foram restauradas", () => {
    expect(shouldSend("presentations_deletion_soon", { ...ctx, offlineDecks: 0 }, {}, now.toISOString(), now).send).toBe(false);
    expect(shouldSend("presentations_offline", { ...ctx, offlineDecks: 0 }, {}, now.toISOString(), now).send).toBe(false);
  });
  it("envia enquanto houver apresentações fora do ar", () => {
    expect(shouldSend("presentations_deletion_soon", { ...ctx, offlineDecks: 2 }, {}, now.toISOString(), now).send).toBe(true);
  });
});
