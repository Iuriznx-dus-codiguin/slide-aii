import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, X, DollarSign, Image as ImageIcon, ExternalLink, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useDeveloperRole } from "@/hooks/useDeveloperRole";
import { useDevSettings } from "@/hooks/useDevSettings";
import {
  saveDevSettings,
  estimateGenerationCost,
  modeFromBudget,
  modeLabel,
  modeDescription,
  type DevSettings,
} from "@/lib/devSettings";

export const DevModePanel = () => {
  const { isDeveloper } = useDeveloperRole();
  const [open, setOpen] = useState(false);
  const s = useDevSettings();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        if (isDeveloper) setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDeveloper]);

  const update = (patch: Partial<DevSettings>) => saveDevSettings({ ...s, ...patch });

  if (!isDeveloper) return null;

  const mode = modeFromBudget(s.maxBudgetUsd);
  const sample = estimateGenerationCost(10, true, mode);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[80] h-10 w-10 rounded-full bg-foreground text-background shadow-2xl flex items-center justify-center hover:scale-105 transition-transform"
        title="Dev Mode (Ctrl+Shift+D)"
        aria-label="Abrir Dev Mode"
      >
        <Terminal className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: 380, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 380, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            className="fixed top-4 right-4 bottom-4 w-[360px] max-w-[calc(100vw-2rem)] z-[90] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden"
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-foreground/5 to-transparent">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                <span className="font-display font-semibold text-sm">DEV MODE</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Ctrl+Shift+D</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-7 w-7">
                <X className="h-4 w-4" />
              </Button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm">
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Bypass paywall</Label>
                  <Switch checked={s.bypassPaywall} onCheckedChange={(v) => update({ bypassPaywall: v })} />
                </div>
                <p className="text-xs text-muted-foreground">Permite gerar sem cobrança/checagem de plano.</p>
              </section>

              <section className="space-y-3 p-3 rounded-lg border border-border bg-gradient-to-br from-primary/5 to-transparent">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Teto por geração
                  </Label>
                  <span className="text-sm font-mono font-semibold">${s.maxBudgetUsd.toFixed(2)}</span>
                </div>
                <Slider
                  value={[s.maxBudgetUsd]} min={0.05} max={2} step={0.05}
                  onValueChange={(v) => update({ maxBudgetUsd: v[0] })}
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>$0.05 · Economia</span>
                  <span>$0.45 · Balanceado</span>
                  <span>$2.00 · Premium</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Gauge className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold">{modeLabel(mode)}</span>
                  <span className="text-[11px] text-muted-foreground leading-snug">— {modeDescription(mode)}</span>
                </div>
              </section>

              <section className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" /> Estimativa (10 slides + imagens)
                </div>
                <div className="space-y-1 font-mono text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Texto IA</span><span>${sample.textUsd.toFixed(3)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pexels ({sample.imagesPexels})</span><span>$0.000</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">IA imagem ({sample.imagesAi})</span><span>${sample.imageUsd.toFixed(3)}</span></div>
                  <div className="flex justify-between font-semibold pt-1 border-t border-border"><span>Total</span><span>${sample.totalUsd.toFixed(3)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Tempo</span><span>~{Math.round(sample.seconds)}s</span></div>
                </div>
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Overlay de custo no preview</Label>
                  <Switch checked={s.showCostOverlay} onCheckedChange={(v) => update({ showCostOverlay: v })} />
                </div>
              </section>

              <Link to="/__dev" className="block">
                <Button variant="hero" className="w-full gap-2">
                  <ExternalLink className="h-4 w-4" /> Dashboard completo
                </Button>
              </Link>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
};
