import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, Briefcase, BookOpen, Palette, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const ROLES = [
  { id: "estudante", label: "Estudante", icon: BookOpen, desc: "Trabalhos escolares e acadêmicos" },
  { id: "professor", label: "Professor", icon: GraduationCap, desc: "Aulas e materiais didáticos" },
  { id: "profissional", label: "Profissional", icon: Briefcase, desc: "Reuniões e relatórios" },
  { id: "criador", label: "Criador de conteúdo", icon: Palette, desc: "Vídeos, cursos e marketing" },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Bem-vindo ao SlideAI";
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const handleContinue = async () => {
    if (!selected || !user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ role: selected }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Tudo pronto!"); navigate("/gerar"); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative">
      <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl md:text-4xl font-bold">Como você pretende usar o SlideAI?</h1>
          <p className="mt-3 text-muted-foreground">Vamos personalizar sua experiência.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {ROLES.map((r, i) => {
            const Icon = r.icon;
            const active = selected === r.id;
            return (
              <motion.button
                key={r.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelected(r.id)}
                className={`text-left p-5 rounded-2xl border-2 transition-all ${active ? "border-primary bg-primary/5 shadow-glow" : "border-border bg-card hover:border-primary/30"}`}
              >
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="font-semibold">{r.label}</div>
                <div className="text-sm text-muted-foreground">{r.desc}</div>
              </motion.button>
            );
          })}
        </div>
        <Button variant="hero" size="lg" className="w-full mt-8" disabled={!selected || saving} onClick={handleContinue}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Continuar
        </Button>
      </motion.div>
    </div>
  );
};

export default Onboarding;
