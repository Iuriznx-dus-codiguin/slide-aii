import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { generateSlug, THEMES, FONTS } from "@/lib/slugify";

const STEPS = [
  "Analisando o tema...",
  "Estruturando os slides...",
  "Buscando dados relevantes...",
  "Adicionando elementos visuais...",
  "Finalizando apresentação...",
];

const Generate = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slidesCount, setSlidesCount] = useState(8);
  const [type, setType] = useState("Corporativo");
  const [language, setLanguage] = useState("pt-BR");
  const [theme, setTheme] = useState("profissional-azul");
  const [fontStyle, setFontStyle] = useState("modern-sans");
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeImages, setIncludeImages] = useState(true);

  useEffect(() => { document.title = "Criar apresentação — SlideAI"; }, []);

  useEffect(() => {
    if (!generating) return;
    const id = setInterval(() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)), 1500);
    return () => clearInterval(id);
  }, [generating]);

  const handleGenerate = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!title.trim()) { toast.error("Informe o título da apresentação"); return; }

    setGenerating(true);
    setStepIdx(0);

    try {
      const { data, error } = await supabase.functions.invoke("generate-presentation", {
        body: { title, description, slidesCount, type, language, theme, fontStyle, includeCharts, includeImages },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.slides?.length) throw new Error("Nenhum slide gerado");

      const slug = generateSlug(title);
      const { data: pres, error: pErr } = await supabase.from("presentations").insert({
        user_id: user.id, title, description, type, language, theme, font_style: fontStyle,
        slug, slides_count: data.slides.length, is_paid: true, is_published: true,
      }).select().single();
      if (pErr) throw pErr;

      const slidesToInsert = data.slides.map((s: any, idx: number) => ({
        presentation_id: pres.id,
        position: idx,
        slide_type: s.slide_type,
        layout_template: s.layout_template,
        speaker_notes: s.speaker_notes,
        animation_transition: "fade",
        content: {
          headline: s.headline, subtitle: s.subtitle, body_text: s.body_text,
          bullets: s.bullets, quote_text: s.quote_text, quote_author: s.quote_author,
          suggested_image_query: s.suggested_image_query, chart: s.chart,
        },
      }));
      const { error: sErr } = await supabase.from("slides").insert(slidesToInsert);
      if (sErr) throw sErr;

      await supabase.rpc as any;
      // increment via direct update
      const { data: profile } = await supabase.from("profiles").select("generations_count").eq("id", user.id).maybeSingle();
      await supabase.from("profiles").update({ generations_count: (profile?.generations_count ?? 0) + 1 }).eq("id", user.id);

      toast.success("Apresentação gerada!");
      navigate(`/slides/${slug}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao gerar apresentação");
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />

      <header className="relative border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </button>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-primary flex items-center justify-center"><Sparkles className="h-4 w-4 text-primary-foreground" /></div>
            <span className="font-display font-bold">SlideAI</span>
          </div>
        </div>
      </header>

      <main className="relative container mx-auto px-6 py-12 max-w-3xl">
        <AnimatePresence mode="wait">
          {!generating ? (
            <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-10">
                <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 uppercase tracking-wider">Gerador IA</div>
                <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">Crie sua <span className="text-gradient">apresentação</span></h1>
                <p className="mt-4 text-muted-foreground">Descreva o tema e a IA fará o resto.</p>
              </div>

              <div className="bg-card border border-border rounded-3xl p-8 shadow-elegant space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Título / Tema *</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Inteligência Artificial no Marketing Digital" maxLength={150} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="desc">Descrição detalhada (opcional)</Label>
                  <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Explorar como ferramentas de IA estão transformando estratégias de marketing, com exemplos práticos e estatísticas recentes." rows={4} maxLength={1000} />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Número de slides</Label>
                    <span className="text-sm font-semibold text-primary">{slidesCount} slides</span>
                  </div>
                  <Slider value={[slidesCount]} onValueChange={([v]) => setSlidesCount(v)} min={3} max={10} step={1} />
                  <p className="text-xs text-muted-foreground">Limite máximo: 10 slides por geração.</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Acadêmico", "Escolar", "Corporativo", "Marketing", "Criativo", "Científico", "Pitch de negócios"].map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Idioma</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt-BR">Português</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Paleta de cores</Label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {Object.entries(THEMES).map(([id, t]) => (
                      <button key={id} type="button" onClick={() => setTheme(id)}
                        className={`aspect-square rounded-xl border-2 transition-all ${theme === id ? "border-primary scale-105" : "border-border"}`}
                        style={{ background: `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)` }}
                        title={t.name} />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Estilo de fonte</Label>
                  <Select value={fontStyle} onValueChange={setFontStyle}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(FONTS).map(([id, f]) => <SelectItem key={id} value={id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border p-4">
                  <div>
                    <div className="font-medium">Incluir gráficos e dados</div>
                    <div className="text-xs text-muted-foreground">A IA criará visualizações quando relevante</div>
                  </div>
                  <Switch checked={includeCharts} onCheckedChange={setIncludeCharts} />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border p-4">
                  <div>
                    <div className="font-medium">Sugerir imagens ilustrativas</div>
                    <div className="text-xs text-muted-foreground">Sugestões para cada slide</div>
                  </div>
                  <Switch checked={includeImages} onCheckedChange={setIncludeImages} />
                </div>

                <Button variant="hero" size="xl" className="w-full" onClick={handleGenerate}>
                  <Sparkles className="h-4 w-4" /> Gerar apresentação
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-20">
              <div className="text-center max-w-md mx-auto">
                <div className="inline-flex items-center justify-center h-20 w-20 rounded-3xl bg-gradient-primary shadow-glow mb-6">
                  <Loader2 className="h-10 w-10 text-primary-foreground animate-spin" />
                </div>
                <h2 className="font-display text-3xl font-bold mb-3">Criando sua apresentação</h2>
                <p className="text-muted-foreground mb-8">Isso pode levar alguns segundos...</p>
                <div className="space-y-3 text-left">
                  {STEPS.map((s, i) => (
                    <motion.div key={s} initial={{ opacity: 0.3 }} animate={{ opacity: i <= stepIdx ? 1 : 0.3 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center ${i < stepIdx ? "bg-primary text-primary-foreground" : i === stepIdx ? "bg-primary/20" : "bg-muted"}`}>
                        {i < stepIdx ? "✓" : i === stepIdx ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : ""}
                      </div>
                      <span className="text-sm">{s}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Generate;
