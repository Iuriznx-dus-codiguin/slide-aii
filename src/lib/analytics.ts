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

// Só parâmetros de campanha vão para o Google. O resto da query pode carregar
// segredo ou dado pessoal: o token de descadastro (/emails/preferencias?t=),
// o destino pós-login (?next=) e ids de autorização OAuth.
const CAMPAIGN_PARAM = /^(utm_[a-z_]+|gclid|gbraid|wbraid)$/;

export function sanitizedLocation(href: string): string {
  const url = new URL(href);
  const kept = new URLSearchParams();
  url.searchParams.forEach((value, key) => {
    if (CAMPAIGN_PARAM.test(key)) kept.append(key, value);
  });
  const query = kept.toString();
  return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
}

// Referência externa (busca, campanha) segue como está; a do próprio site
// passa pelo mesmo filtro da página.
function sanitizedReferrer(): string {
  const ref = document.referrer;
  try {
    return ref && new URL(ref).origin === window.location.origin ? sanitizedLocation(ref) : ref;
  } catch {
    return "";
  }
}

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
  // Vale para a configuração abaixo e para todo evento: sem isto o gtag manda
  // a URL completa da página (com a query) ao Google Ads e ao GA4.
  window.gtag("set", { page_location: sanitizedLocation(window.location.href), page_referrer: sanitizedReferrer() });
  window.gtag("js", new Date());
  if (GA4_ID) window.gtag("config", GA4_ID, { send_page_view: false });
  window.gtag("config", ADS_ID);
}

export function trackPageView(path: string) {
  if (!initialized) return;
  const location = sanitizedLocation(new URL(path, window.location.origin).href);
  window.gtag("set", { page_location: location });
  if (!GA4_ID) return;
  window.gtag("event", "page_view", { page_path: new URL(location).pathname, page_location: location, send_to: GA4_ID });
}

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (!initialized) return;
  window.gtag("event", name, params);
}
