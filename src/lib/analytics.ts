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
  window.gtag("js", new Date());
  if (GA4_ID) window.gtag("config", GA4_ID, { send_page_view: false });
  window.gtag("config", ADS_ID);
}

export function trackPageView(path: string) {
  if (!initialized || !GA4_ID) return;
  window.gtag("event", "page_view", { page_path: path, send_to: GA4_ID });
}

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (!initialized) return;
  window.gtag("event", name, params);
}
