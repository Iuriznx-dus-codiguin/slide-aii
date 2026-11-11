import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { HostingStatus } from "@/lib/hosting";

/** Situação da hospedagem da conta logada (assinatura vigente ou não). */
export const useHostingStatus = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<HostingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) { setStatus(null); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    supabase.rpc("my_hosting_status").then(({ data }) => {
      if (!alive) return;
      setStatus((data as unknown as HostingStatus | null) ?? null);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [user]);
  return { status, loading };
};
