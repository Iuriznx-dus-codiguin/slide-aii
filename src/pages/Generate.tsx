import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Loader2, ArrowLeft, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDeveloperRole } from "@/hooks/useDeveloperRole";
import { useEntitlement } from "@/hooks/useEntitlement";
import { estimateGenerationCost, modeFromBudget } from "@/lib/devSettings";
import { useDevSettings } from "@/hooks/useDevSettings";
import { CREDITS_PER_SLIDE, DEPTH_CREDITS, SPEECHES_CREDITS, isMaxPlan } from "@/lib/cakto";
import { toast } from "sonner";
import { THEMES, autoFontForContext, resolveFontPairing } from "@/lib/slugify";
import { TEMPLATES } from "@/lib/templates";
import { PRESENTATION_TYPES, toUiPresentationType } from "@/lib/presentationTypes";
import { defaultsForRole } from "@/lib/personaDefaults";
import { persistLegacyDeck, type LegacyResponse } from "@/lib/legacyPersist";
import { PaymentGate } from "@/components/PaymentGate";
import { reasonMessage, needsRenewal } from "@/hooks/useEntitlement";
import { CreditCard, RefreshCw, AlertTriangle, Coins } from "lucide-react";

/**
 * Corpo JSON de um erro de edge function.
 *
 * `supabase.functions.invoke` resolve com um FunctionsHttpError genérico
 * quando o status não é 2xx e não expõe o corpo — que é justamente onde o
 * backend explica a causa (failure_code) e informa o estorno. A Response
 * original fica em `error.context`.
 */
interface GenerationErrorBody {
  error?: string;
  reason?: string;
  failure_code?: string;
  credits_refunded?: number;
}

const readFunctionError = async (error: unknown): Promise<GenerationErrorBody | null> => {
  const context = (error as { context?: unknown })?.context;
  if (!(context instanceof Response)) return null;
  try {
    return await context.clone().json();
  } catch {
    return null;
  }
};

/** Indicador compacto de custo em créditos de uma etapa (número + símbolo de IA). */
const CreditTag = ({ value, title }: { value: number; title?: string }) => (
  <span
    title={title ?? `${value} créditos`}
    className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary tabular-nums"
  >
    {value.toLocaleString("pt-BR")} <Sparkles className="h-3 w-3" />
  </span>
);




// Cota gratuita (escondida do usuário pago — pagos veem o teto real do plano)
const FREE_GENERATIONS_LIMIT = 1;

// Valores iniciais do formulário. Nomeados porque o pré-preenchimento por
// perfil (profiles.role) só sobrescreve campos que ainda estão nestes valores.
const INITIAL_PERSONA = "educator";
const INITIAL_TYPE = "Escolar";
const INITIAL_TEXT_DEPTH = "balanced" as const;

// Etapas reais do motor (Direção → Plano Visual → Conteúdo → Resolução →
// Persistência). Tudo roda no servidor numa única chamada, então o progresso
// é estimado por tempo e só a última etapa espera a resposta de verdade.
const STEPS = [
  "Dirigindo a cena: tom, domínio e ritmo...",
  "Roteirizando o arco narrativo...",
  "Planejando o visual de cada slide...",
  "Escrevendo conteúdo e diagramas...",
  "Validando layout, contraste e ritmo...",
  "Salvando sua apresentação...",
  "Abrindo o editor...",
];
const STEP_INTERVAL_MS = 3800;

const Generate = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDeveloper } = useDeveloperRole();
  const ent = useEntitlement();
  const [searchParams] = useSearchParams();
  const [phase, setPhase] = useState<"form" | "loading">("form");
  const [stepIdx, setStepIdx] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const devSettings = useDevSettings();
  // Habilita gerar quando o usuário possui crédito/assinatura ativa ou é dev.
  const canGenerate = ent.allowed;

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slidesCount, setSlidesCount] = useState(8);
  const [type, setType] = useState(INITIAL_TYPE);
  const [language, setLanguage] = useState("pt-BR");
  const [theme, setTheme] = useState("auto");
  // A fonte é escolhida automaticamente (tipo + tema + título) e, quando a IA
  // devolve `font_pairing`, é ela quem manda — decidido no servidor, que
  // grava a apresentação. O form não expõe esse controle.
  const fontStyle = autoFontForContext(type, theme, title);
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeImages, setIncludeImages] = useState(true);
  const [preferDynamic, setPreferDynamic] = useState(true);
  // DNA narrativo (Fase 2.5+)
  const [persona, setPersona] = useState<string>(INITIAL_PERSONA);
  // Profundidade dos textos (substitui a antiga "Identidade de marca"):
  // controla contextualização e riqueza de detalhes, não só nº de palavras.
  const [textDepth, setTextDepth] = useState<"short" | "balanced" | "long">(INITIAL_TEXT_DEPTH);
  const [presentersCount, setPresentersCount] = useState(1);
  const [presentersNames, setPresentersNames] = useState<string[]>(["Apresentador 1"]);
  const [includeSpeeches, setIncludeSpeeches] = useState(false);

  // ── Custo em créditos da geração atual (usado nos indicadores e nas barreiras) ──
  const slidesCost = slidesCount * CREDITS_PER_SLIDE;
  const depthCost = DEPTH_CREDITS[textDepth] ?? DEPTH_CREDITS.balanced;
  const speechCost = includeSpeeches ? SPEECHES_CREDITS : 0;
  const totalCost = slidesCost + depthCost + speechCost;
  const unlimitedCredits = isMaxPlan(ent.plan) || isDeveloper;
  const balanceAfter = ent.credits_available - totalCost;
  /** Usuário tem algum saldo — só ele vê avisos de limite; quem não tem nada
   *  compra após configurar (botão vira "Continuar para pagamento"). */
  const hasBalance = ent.credits_available > 0;
  /** Custo excede o saldo disponível: avisa, mas não bloqueia — o CTA leva ao pagamento. */
  const insufficientCredits = !unlimitedCredits && hasBalance && balanceAfter < 0;
  /** Saldo baixo (mensal + bônus quase zerados) — avisa antes de consumir. */
  const lowBalance = !unlimitedCredits && ent.allowed && !insufficientCredits
    && (ent.credits_available <= 300 || balanceAfter <= 100);
  /** Máximo de slides que ainda cabe no saldo disponível. */
  const maxAffordableSlides = unlimitedCredits
    ? 20
    : Math.max(5, Math.min(20, Math.floor((ent.credits_available - depthCost - speechCost) / CREDITS_PER_SLIDE)));


  useEffect(() => { document.title = "Criar apresentação — SlideAI"; }, []);

  // Pré-preencher a partir do perfil escolhido no onboarding (profiles.role).
  // Só roda uma vez, e nunca quando há ?template= — o template é uma escolha
  // explícita do usuário e tem precedência sobre o padrão do perfil.
  const rolePrefillDone = useRef(false);
  useEffect(() => {
    if (rolePrefillDone.current || !user || searchParams.get("template")) return;
    rolePrefillDone.current = true;
    (async () => {
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      const defaults = defaultsForRole(data?.role);
      if (!defaults) return;
      // A leitura é assíncrona: se o usuário já mexeu no campo enquanto ela
      // estava em voo, a escolha dele vence. Só preenche o que ainda está no
      // valor inicial do formulário.
      setPersona((cur) => (cur === INITIAL_PERSONA ? defaults.persona : cur));
      setType((cur) => (cur === INITIAL_TYPE ? defaults.type : cur));
      setTextDepth((cur) => (cur === INITIAL_TEXT_DEPTH ? defaults.textDepth : cur));
    })();
  }, [user, searchParams]);

  // Pré-preencher a partir de ?template=ID
  useEffect(() => {
    const tplId = searchParams.get("template");
    if (!tplId) return;
    const tpl = TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    setTitle(tpl.seed.title);
    setDescription(tpl.seed.description);
    setSlidesCount(Math.max(5, Math.min(20, tpl.seed.slidesCount)));
    setType(toUiPresentationType(tpl.seed.type));
    setTheme(tpl.seed.theme);
    // fontStyle é derivado do contexto — templates não sobrescrevem mais.
    setIncludeCharts(tpl.seed.includeCharts);
    setIncludeImages(tpl.seed.includeImages);
    toast.success(`Template "${tpl.title}" carregado — ajuste e gere!`);
  }, [searchParams]);

  // Progresso estimado enquanto o servidor trabalha (a última etapa espera a
  // resposta real).
  useEffect(() => {
    if (phase !== "loading") return;
    const id = setInterval(() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 2)), STEP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [phase]);

  const handleGenerate = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!title.trim()) { toast.error("Informe o título da apresentação"); return; }
    await ent.refresh();
    if (!ent.allowed && !isDeveloper) {
      if (ent.reason === "insufficient_credits") {
        // Saldo existe mas não cobre: abre o pagamento para completar/recarregar.
        setShowPayment(true);
        return;
      }
      if (ent.reason === "system_error") {
        toast.error(reasonMessage("system_error"));
        return;
      }
      if (needsRenewal(ent.reason)) {
        toast.error(reasonMessage(ent.reason), {
          action: { label: "Renovar", onClick: () => navigate("/perfil?tab=assinatura") },
        });
        return;
      }
      setShowPayment(true);
      return;
    }

    // Saldo insuficiente para esta configuração: em vez de bloquear, leva ao
    // pagamento (o usuário pode comprar créditos/plano e voltar com tudo salvo).
    if (!unlimitedCredits && totalCost > ent.credits_available) {
      setShowPayment(true);
      return;
    }




    setPhase("loading");
    setStepIdx(0);

    try {
      const { data, error } = await supabase.functions.invoke("generate-presentation", {
        body: {
          title, description, slidesCount, type, language, theme, fontStyle,
          includeCharts, includeImages,
          persona, textDepth, presentersCount, presentersNames, includeSpeeches,
          preferDynamic,
          image_budget_mode: modeFromBudget(devSettings.maxBudgetUsd),
          max_budget_usd: devSettings.maxBudgetUsd,
          // O servidor grava o deck e devolve o slug (sem perda de deck pago
          // ao fechar a aba, com o creative_brief certo).
          persist: "server",
          // Motor de cenas (v2) sob demanda no Dev Mode; sem pedido, vale o
          // rollout configurado no servidor.
          ...(devSettings.engineV2 ? { engineVersion: 2 } : {}),
        },
      });

      // Numa resposta não-2xx o supabase-js entrega um FunctionsHttpError
      // genérico ("non-2xx status code") e descarta o corpo — era por isso
      // que toda falha virava a mesma frase na tela. O corpo real vem em
      // `error.context` (a Response original) e traz a causa identificada
      // pelo backend e quanto foi estornado.
      const payload = data ?? (error ? await readFunctionError(error) : null);

      if (payload?.error) {
        if (typeof payload.credits_refunded === "number" && payload.credits_refunded > 0) {
          await ent.refresh();
        }
        if (payload.reason === "insufficient_credits") {
          toast.error(payload.error || reasonMessage("insufficient_credits"));
          setPhase("form");
          return;
        }
        throw new Error(payload.error);
      }
      if (error) throw error;

      // Caminho principal: o deck já está salvo no servidor.
      if (data?.slug) {
        setStepIdx(STEPS.length - 1);
        toast.success("Apresentação criada! Abrindo editor…");
        navigate(`/editor/${data.slug}`);
        return;
      }

      // Servidor ainda sem persistência (janela de rollout): grava aqui, no
      // formato antigo, já com o brief da resposta.
      if (!data?.slides?.length) throw new Error("Nenhum slide gerado");
      if (!user) throw new Error("Sessão expirada");
      const fontId = resolveFontPairing(data.font_pairing, autoFontForContext(type, theme, title));
      const slug = await persistLegacyDeck(
        {
          userId: user.id, title, description, type, language, theme, fontStyle: fontId, persona, textDepth,
          presentersCount, presentersNames, includeSpeeches, includeImages,
        },
        data as LegacyResponse,
        fontId,
        (done, total) => { if (total > 0) setStepIdx(Math.min(STEPS.length - 2, 3 + Math.round((done / total) * 2))); },
      );
      setStepIdx(STEPS.length - 1);
      toast.success("Apresentação criada! Abrindo editor…");
      navigate(`/editor/${slug}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao gerar. Tente reduzir o número de slides.");
      setPhase("form");
    }
  };

  // ───────────────────────── LOADING PHASE ─────────────────────────
  if (phase === "loading") {
    const progressPct = Math.min(100, Math.round(((stepIdx + 1) / STEPS.length) * 100));
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background relative overflow-hidden">
        {/* Fundo cinematográfico com orbes animados — reforça a sensação de "algo grande sendo forjado" */}
        <div className="absolute inset-0 bg-gradient-glow opacity-40 pointer-events-none" />
        <motion.div
          aria-hidden
          className="absolute -top-32 -left-32 h-96 w-96 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)/0.35), transparent 70%)", filter: "blur(60px)" }}
          animate={{ x: [0, 60, -30, 0], y: [0, 40, -20, 0], scale: [1, 1.15, 0.95, 1] }}
          transition={{ repeat: Infinity, duration: 14, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(var(--accent)/0.28), transparent 70%)", filter: "blur(80px)" }}
          animate={{ x: [0, -50, 30, 0], y: [0, -30, 20, 0], scale: [1, 0.9, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 18, ease: "easeInOut" }}
        />
        {/* Grid sutil de partículas */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative max-w-lg w-full">
          <div className="text-center mb-8">
            {/* Ícone com camadas rotativas em velocidades diferentes — sensação de sistema complexo em ação */}
            <div className="relative inline-flex items-center justify-center h-28 w-28 mb-6">
              <motion.div
                aria-hidden
                className="absolute inset-0 rounded-full border-2 border-primary/30"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
                style={{ borderTopColor: "hsl(var(--primary))", borderRightColor: "transparent", borderBottomColor: "transparent" }}
              />
              <motion.div
                aria-hidden
                className="absolute inset-2 rounded-full border border-accent/40"
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 9, ease: "linear" }}
                style={{ borderBottomColor: "hsl(var(--accent))", borderLeftColor: "transparent", borderTopColor: "transparent" }}
              />
              <motion.div
                animate={{ scale: [1, 1.08, 1], boxShadow: ["0 0 24px hsl(var(--primary)/0.4)", "0 0 48px hsl(var(--primary)/0.7)", "0 0 24px hsl(var(--primary)/0.4)"] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
                className="relative inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-primary"
              >
                <Sparkles className="h-8 w-8 text-primary-foreground" />
              </motion.div>
            </div>
            <motion.h2
              key={stepIdx}
              initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-3xl md:text-4xl font-bold tracking-tight"
            >
              {STEPS[stepIdx] ?? "Finalizando..."}
            </motion.h2>
            <p className="text-muted-foreground mt-2 text-sm">Direção de arte, roteiro e ilustração — tudo em segundos.</p>
          </div>

          {/* Barra de progresso principal */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span className="font-mono uppercase tracking-wider">Progresso</span>
              <span className="font-mono font-semibold text-primary">{progressPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden relative">
              <motion.div
                className="h-full bg-gradient-primary relative"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.div
                  aria-hidden
                  className="absolute inset-0 bg-white/40"
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }}
                  style={{ mixBlendMode: "overlay" }}
                />
              </motion.div>
            </div>
          </div>

          <div className="space-y-1.5">
            {STEPS.map((s, i) => (
              <motion.div
                key={s}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: i <= stepIdx ? 1 : 0.35, x: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${
                  i === stepIdx ? "border-primary/50 bg-primary/5" : "border-border bg-card/50"
                }`}
              >
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                  i < stepIdx ? "bg-primary text-primary-foreground" : i === stepIdx ? "bg-primary/20" : "bg-muted"
                }`}>
                  {i < stepIdx ? "✓" : i === stepIdx ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : <span className="text-muted-foreground">{i + 1}</span>}
                </div>
                <span className="text-sm flex-1">{s}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // ───────────────────────── FORM PHASE ─────────────────────────
  return (
    <div className="min-h-screen bg-background relative">
      <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />

      <header className="relative border-b border-border">
        <div className="container mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Dashboard</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-primary flex items-center justify-center"><Sparkles className="h-4 w-4 text-primary-foreground" /></div>
            <span className="font-display font-bold">SlideAI</span>
          </div>
        </div>
      </header>

      <main className="relative container mx-auto px-4 md:px-6 py-8 md:py-12 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8 md:mb-10">
            <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 uppercase tracking-wider">Gerador IA</div>
            <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight">Crie sua <span className="text-gradient">apresentação</span></h1>
            <p className="mt-3 text-sm md:text-base text-muted-foreground">Descreva o tema. A IA escreve, ilustra e desenha — você refina via chat.</p>
          </div>

          {!canGenerate && !ent.loading && needsRenewal(ent.reason) && (
            <div className="mb-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 md:p-5">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-destructive/15 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <div className="text-sm flex-1">
                  <p className="font-semibold">
                    {ent.reason === "subscription_canceled"
                      ? "Assinatura cancelada — gerações pausadas"
                      : "Assinatura expirada — gerações pausadas"}
                  </p>
                  <p className="text-muted-foreground mt-1">{reasonMessage(ent.reason)}</p>
                  <div className="mt-3 rounded-xl border border-border bg-background/60 p-3">
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">Como renovar</p>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Abra <strong className="text-foreground">Perfil → Assinatura</strong>.</li>
                      <li>Escolha o plano (único, mensal, trimestral ou anual) e conclua o pagamento.</li>
                      <li>A liberação é automática assim que o pagamento é confirmado — volte aqui e gere normalmente.</li>
                    </ol>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="hero" onClick={() => navigate("/perfil?tab=assinatura")}>
                      <RefreshCw className="h-4 w-4" /> Renovar assinatura
                    </Button>
                    <Button variant="outline" onClick={() => ent.refresh()}>
                      Já paguei, atualizar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!canGenerate && !ent.loading && !needsRenewal(ent.reason) && (
            <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-4 md:p-5 flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <div className="text-sm flex-1">
                <p className="font-semibold">Configure abaixo e escolha um plano para gerar</p>
                <p className="text-muted-foreground mt-1">
                  Defina o tema, slides e estilo. O pagamento acontece após a configuração — a geração inicia automaticamente assim que o pagamento for confirmado.
                </p>
              </div>
            </div>

          )}

          {canGenerate && devSettings.showCostOverlay && (() => {
            const est = estimateGenerationCost(slidesCount, includeImages, devSettings.maxBudgetUsd, devSettings.engineV2 ? 2 : 1);
            const overBudget = est.totalUsd > devSettings.maxBudgetUsd;
            return (
              <div className={`mb-6 rounded-2xl border p-3 md:p-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono ${overBudget ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/30"}`}>
                <span className="uppercase tracking-wider text-muted-foreground">Dev · estimativa</span>
                <span>${est.totalUsd.toFixed(3)}</span>
                <span className="text-muted-foreground">~{Math.round(est.seconds)}s</span>
                <span className="text-muted-foreground">Pexels {est.imagesPexels} · IA {est.imagesAi}</span>
                <span className="text-muted-foreground">modo: {est.mode}</span>
                <span className="text-muted-foreground">motor: v{devSettings.engineV2 ? 2 : 1}</span>
                <span className="text-muted-foreground">teto: ${devSettings.maxBudgetUsd.toFixed(2)}</span>
                {overBudget && <span className="text-destructive font-semibold">⚠ acima do teto</span>}
              </div>
            );
          })()}

          <div className="bg-card border border-border rounded-3xl p-5 md:p-8 shadow-elegant space-y-5 md:space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Título / Tema *</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: História da Espanha medieval" maxLength={150}
                className="h-12 text-base md:h-10 md:text-sm" autoComplete="off" enterKeyHint="next" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">Descrição <span className="text-primary text-xs font-semibold">(recomendado)</span></Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o ângulo, público-alvo, tom desejado — quanto mais contexto, mais rica a apresentação." rows={3} maxLength={1000}
                className="text-base md:text-sm min-h-[96px]" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>Número de slides</Label>
                  {!unlimitedCredits && <CreditTag value={slidesCost} title={`${CREDITS_PER_SLIDE} créditos por slide`} />}
                </div>
                <span className="text-sm font-semibold text-primary">{slidesCount}</span>
              </div>
              <Slider value={[slidesCount]} onValueChange={([v]) => setSlidesCount(v)} min={5} max={20} step={1} />
              <p className="text-xs text-muted-foreground">De 5 a 20 slides — recomendado entre 8 e 14 para máxima coesão narrativa.</p>
              {!unlimitedCredits && hasBalance && slidesCount > maxAffordableSlides && (
                <p className="text-xs text-destructive font-medium">
                  Seu saldo cobre até {maxAffordableSlides} slides com as opções atuais.
                  <button type="button" className="underline ml-1" onClick={() => setSlidesCount(maxAffordableSlides)}>
                    Ajustar
                  </button>
                </p>
              )}
            </div>



            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRESENTATION_TYPES.map((t) => (
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
              <div className="flex items-center justify-between">
                <Label>Tema visual</Label>
                {theme === "auto" && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-primary font-medium">
                    <Wand2 className="h-3 w-3" /> A IA escolherá as cores
                  </span>
                )}
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-5 gap-2">
                {Object.entries(THEMES).map(([id, t]) => (
                  <button key={id} type="button" onClick={() => setTheme(id)} aria-label={t.name} aria-pressed={theme === id}
                    className={`aspect-square min-h-[52px] rounded-xl border-2 transition-all relative overflow-hidden active:scale-95 ${theme === id ? "border-primary scale-105 shadow-glow" : "border-border hover:border-muted-foreground/40"}`}
                    style={ id === "auto" ? { background: "conic-gradient(from 0deg, #ff5e5b, #f9c74f, #43aa8b, #277da1, #9d4edd, #ff5e5b)" } : { background: `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)` }}
                    title={t.name}>
                    {id === "auto" && <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-white drop-shadow" />}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{THEMES[theme]?.name}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm">Gráficos & dados</div>
                  <div className="text-[11px] text-muted-foreground">A IA cria visualizações</div>
                </div>
                <Switch checked={includeCharts} onCheckedChange={setIncludeCharts} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm">Imagens reais</div>
                  <div className="text-[11px] text-muted-foreground">Pexels + IA (OpenAI)</div>
                </div>
                <Switch checked={includeImages} onCheckedChange={setIncludeImages} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/5 p-3 sm:col-span-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Slide Dinâmico (magic move)
                  </div>
                  <div className="text-[11px] text-muted-foreground">Título e imagem-hero migram entre slides — em vez de troca abrupta.</div>
                </div>
                <Switch checked={preferDynamic} onCheckedChange={setPreferDynamic} />
              </div>
              <div className="rounded-xl border border-border p-3 sm:col-span-2">
                <div className="min-w-0 mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary" /> Profundidade dos textos
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Define quanta contextualização, exemplos e detalhes cada slide traz.
                    </div>
                  </div>
                  {!unlimitedCredits && <CreditTag value={depthCost} title="Custo da profundidade escolhida" />}
                </div>
                <Select value={textDepth} onValueChange={(v) => setTextDepth(v as typeof textDepth)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Curto — uma ideia afiada por slide (+10 créditos)</SelectItem>
                    <SelectItem value="balanced">Equilibrado — clareza com substância (+20 créditos)</SelectItem>
                    <SelectItem value="long">Longo — contexto, causa, exemplo e implicação (+30 créditos)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>

            {/* DNA narrativo (Fase 2.5) — profundidade fica implícita ("high-level") */}
            <div className="pt-2 border-t border-border space-y-2">
              <Label>Persona do orador</Label>
              <Select value={persona} onValueChange={setPersona}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="educator">Educador (didático)</SelectItem>
                  <SelectItem value="technical-authority">Autoridade técnica</SelectItem>
                  <SelectItem value="inspirational-leader">Líder inspiracional</SelectItem>
                  <SelectItem value="salesperson">Vendedor (dor→solução)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Apresentadores</Label>
                <span className="text-sm font-semibold text-primary">{presentersCount}</span>
              </div>
              <Slider value={[presentersCount]} onValueChange={([v]) => {
                setPresentersCount(v);
                setPresentersNames((prev) => {
                  const next = [...prev];
                  while (next.length < v) next.push(`Apresentador ${next.length + 1}`);
                  return next.slice(0, v);
                });
              }} min={1} max={8} step={1} />
              {presentersCount > 1 && (
                <div className="grid sm:grid-cols-2 gap-2">
                  {Array.from({ length: presentersCount }).map((_, i) => (
                    <Input key={i} value={presentersNames[i] ?? ""} placeholder={`Nome ${i + 1}`}
                      onChange={(e) => setPresentersNames((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })} />
                  ))}
                </div>
              )}
              {(() => {
                const canAffordSpeeches = unlimitedCredits || !hasBalance
                  || ent.credits_available >= slidesCost + depthCost + SPEECHES_CREDITS;
                return (
                  <div className="rounded-xl border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm flex items-center gap-2">
                          Gerar falas dos apresentadores
                          {!unlimitedCredits && <CreditTag value={SPEECHES_CREDITS} title="Custo de ativar as falas" />}
                        </div>
                        <div className="text-[11px] text-muted-foreground">Script conciso (40-80 palavras) por slide, distribuído em blocos</div>
                      </div>
                      <Switch
                        checked={includeSpeeches}
                        disabled={!canAffordSpeeches && !includeSpeeches}
                        onCheckedChange={setIncludeSpeeches}
                      />
                    </div>
                    {!canAffordSpeeches && !includeSpeeches && (
                      <p className="text-[11px] text-destructive">
                        Saldo insuficiente para incluir as falas nesta configuração.
                      </p>
                    )}
                  </div>
                );
              })()}

            </div>

            {!unlimitedCredits && (
              <div className={`rounded-2xl border p-4 space-y-2 ${insufficientCredits ? "border-destructive/50 bg-destructive/5" : "border-primary/40 bg-primary/5"}`}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Coins className="h-4 w-4 text-primary" /> Subtotal da geração
                </div>
                <dl className="text-xs space-y-1">
                  <div className="flex justify-between"><dt className="text-muted-foreground">{slidesCount} slides × {CREDITS_PER_SLIDE}</dt><dd>{slidesCost.toLocaleString("pt-BR")}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Profundidade dos textos</dt><dd>{depthCost}</dd></div>
                  {speechCost > 0 && (
                    <div className="flex justify-between"><dt className="text-muted-foreground">Falas dos apresentadores</dt><dd>{speechCost}</dd></div>
                  )}
                  <div className="flex justify-between pt-2 mt-1 border-t border-primary/30 text-sm font-bold">
                    <dt>Subtotal</dt>
                    <dd className="text-primary inline-flex items-center gap-1">
                      {totalCost.toLocaleString("pt-BR")} <Sparkles className="h-3.5 w-3.5" />
                    </dd>
                  </div>
                </dl>
                <p className={`text-[11px] ${insufficientCredits ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {!hasBalance
                    ? "Você ainda não tem créditos — ao continuar, escolha um plano e a geração inicia após a confirmação do pagamento."
                    : insufficientCredits
                      ? `Saldo insuficiente: você tem ${ent.credits_available.toLocaleString("pt-BR")} créditos (mensal ${ent.credits_monthly.toLocaleString("pt-BR")} + bônus ${ent.credits_bonus.toLocaleString("pt-BR")}). Ajuste as opções ou continue para adquirir mais créditos.`
                      : `Saldo atual: ${ent.credits_available.toLocaleString("pt-BR")} → após gerar: ${Math.max(0, balanceAfter).toLocaleString("pt-BR")}`}
                </p>
                {lowBalance && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                    Seus créditos estão acabando (mensal {ent.credits_monthly.toLocaleString("pt-BR")} · bônus {ent.credits_bonus.toLocaleString("pt-BR")}). Após esta geração restarão {Math.max(0, balanceAfter).toLocaleString("pt-BR")} créditos.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">A cota mensal é consumida primeiro; os créditos bônus só depois.</p>
              </div>
            )}

            {/* No mobile o CTA fica fixo ao alcance do polegar. */}

            <Button variant="hero" size="xl"
              className="w-full sticky bottom-3 z-20 shadow-glow md:static md:shadow-elegant"
              onClick={handleGenerate} disabled={ent.loading}>
              <Sparkles className="h-4 w-4" /> {unlimitedCredits || (canGenerate && !insufficientCredits) ? "Gerar apresentação" : "Continuar para pagamento"}
            </Button>

          </div>
        </motion.div>
      </main>

      {/* Modal de limite (apenas free) — escondido para usuários pagos */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowLimitModal(false)}>
          <div className="bg-card border border-border rounded-3xl p-8 max-w-md w-full shadow-elegant" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-primary mx-auto mb-4">
              <Sparkles className="h-7 w-7 text-primary-foreground" />
            </div>
            <h3 className="font-display text-2xl font-bold text-center">Faça upgrade para continuar</h3>
            <p className="text-center text-muted-foreground mt-2 text-sm">
              Você atingiu o limite de testes gratuitos. Assine um plano PRO ou MAX para gerar apresentações completas.
            </p>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowLimitModal(false)}>Agora não</Button>
              <Button variant="hero" className="flex-1" onClick={() => navigate("/#pricing")}>Ver planos</Button>
            </div>
          </div>
        </div>
      )}

      <PaymentGate
        open={showPayment}
        onClose={() => setShowPayment(false)}
        onUnlocked={() => { setShowPayment(false); handleGenerate(); }}
      />
    </div>
  );
};

export default Generate;
