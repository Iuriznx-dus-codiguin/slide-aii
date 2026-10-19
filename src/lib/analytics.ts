// Google tag (gtag.js): GA4 (via conector) + Google Ads (AW-18513941668).
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

const ADS_ID = "AW-18513941668";
const GA4_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY as string | undefined;

let initialized = false;

// O que sai do site para o Google: só parâmetros de campanha. Os demais (o
// código de acesso ?t= das preferências de e-mail, o ?code= do login, o ?next=
// etc.) ficam de fora, assim como o fragmento (#access_token na troca de senha).
const KEEP_PARAMS = /^(utm_[a-z_]+|gclid|gbraid|wbraid|gad_source)$/;

// Rotas cujo segmento final é conteúdo do usuário (o slug vem do título da
// apresentação; o nome de usuário e o id do atendimento identificam pessoas).
const MASKED_ROUTES: [RegExp, string][] = [
  [/^\/slides\/[^/]+/, "/slides/:slug"],
  [/^\/editor\/[^/]+/, "/editor/:slug"],
  [/^\/u\/[^/]+/, "/u/:username"],
  [/^\/suporte\/[^/]+/, "/suporte/:id"],
];

/** Endereço e título que podem ir para o Google Analytics/Ads. */
export function safePage(href: string, title: string): { path: string; location: string; title: string } {
  const url = new URL(href);
  const masked = MASKED_ROUTES.find(([re]) => re.test(url.pathname));
  const pathname = masked ? url.pathname.replace(masked[0], masked[1]) : url.pathname;
  const params = new URLSearchParams();
  url.searchParams.forEach((value, key) => { if (KEEP_PARAMS.test(key)) params.append(key, value); });
  const qs = params.toString();
  const path = pathname + (qs ? `?${qs}` : "");
  // O título dessas páginas é o da apresentação ou o nome da pessoa.
  return { path, location: url.origin + path, title: masked ? "SlideAI" : title };
}

const currentPage = () => safePage(window.location.href, document.title);

export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const primary = GA4_ID || ADS_ID;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${primary}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params -- gtag.js precisa do objeto arguments
    window.dataLayer.push(arguments);
  };
  window.gtag("set", "developer_id.dZjgwMW", true);
  // Antes de qualquer config: o Google Ads registra a visita ao configurar.
  const page = currentPage();
  window.gtag("set", { page_location: page.location, page_title: page.title, page_referrer: safeReferrer() });
  window.gtag("js", new Date());
  if (GA4_ID) window.gtag("config", GA4_ID, { send_page_view: false });
  window.gtag("config", ADS_ID);
}

/** Referência externa sem query string (a interna pode carregar códigos de acesso). */
function safeReferrer(): string {
  try {
    if (!document.referrer) return "";
    const ref = new URL(document.referrer);
    return ref.origin === window.location.origin ? safePage(ref.href, "").location : ref.origin + ref.pathname;
  } catch {
    return "";
  }
}

export function trackPageView() {
  if (!initialized) return;
  const page = currentPage();
  // Vale também para os próximos eventos (inclusive os do Google Ads).
  window.gtag("set", { page_location: page.location, page_title: page.title });
  if (!GA4_ID) return;
  window.gtag("event", "page_view", {
    page_path: page.path, page_location: page.location, page_title: page.title, send_to: GA4_ID,
  });
}

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (!initialized) return;
  window.gtag("event", name, params);
}
