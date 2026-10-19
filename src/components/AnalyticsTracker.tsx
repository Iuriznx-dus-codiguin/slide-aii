import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/analytics";

export const AnalyticsTracker = () => {
  const location = useLocation();
  useEffect(() => {
    // Endereço e título saem já sem dados pessoais (ver safePage).
    trackPageView();
  }, [location.pathname, location.search]);
  return null;
};
