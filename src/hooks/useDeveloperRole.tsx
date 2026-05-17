import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useDeveloperRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setIsDeveloper(false); setIsAdmin(false); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (cancelled) return;
      const roles = (data ?? []).map((r: any) => r.role);
      setIsDeveloper(roles.includes("developer") || roles.includes("admin"));
      setIsAdmin(roles.includes("admin"));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return { isDeveloper, isAdmin, loading };
};
