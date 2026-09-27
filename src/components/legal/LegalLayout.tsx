// Layout comum dos documentos legais (Termos de Uso, Política de Privacidade).
//
// • Sumário lateral com âncoras estáveis — o checkout, os artigos de ajuda e
//   as mensagens do sistema linkam direto para cláusulas (/termos#uso-justo).
// • Versão e data em destaque, e botão para imprimir/salvar em PDF: o
//   contrato precisa poder ser conservado e reproduzido pelo consumidor
//   (Decreto 7.962/2013, art. 4º, IV).
import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Printer } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TocItem {
  id: string;
  label: string;
}

interface LegalLayoutProps {
  title: string;
  seoTitle: string;
  description: string;
  path: string;
  version: string;
  effectiveDate: string;
  intro?: ReactNode;
  toc: TocItem[];
  children: ReactNode;
}

export const LegalLayout = ({ title, seoTitle, description, path, version, effectiveDate, intro, toc, children }: LegalLayoutProps) => {
  const { hash } = useLocation();

  // O React Router não rola até a âncora sozinho em navegação SPA.
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0 });
      return;
    }
    const id = decodeURIComponent(hash.slice(1));
    const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    return () => window.clearTimeout(t);
  }, [hash]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Seo title={seoTitle} description={description} path={path} />
      <div className="print:hidden"><Navbar /></div>
      <main className="flex-1 pt-28 pb-20 print:pt-0">
        <div className="container mx-auto px-6 max-w-6xl">
          <header className="max-w-3xl">
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">{title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span>Versão <strong className="text-foreground">{version}</strong></span>
              <span>Vigente desde <strong className="text-foreground">{effectiveDate}</strong></span>
              <Button variant="outline" size="sm" className="print:hidden" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Imprimir ou salvar em PDF
              </Button>
            </div>
            {intro && <div className="mt-6 space-y-3 text-muted-foreground leading-relaxed">{intro}</div>}
          </header>

          <div className="mt-10 grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
            <nav aria-label="Sumário" className="print:hidden lg:sticky lg:top-28 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Sumário</p>
              <ol className="space-y-1.5 text-sm">
                {toc.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className="text-muted-foreground hover:text-foreground transition-colors leading-snug block">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
            <article className="max-w-3xl min-w-0 space-y-12 text-[15px] leading-relaxed">{children}</article>
          </div>
        </div>
      </main>
      <div className="print:hidden"><Footer /></div>
    </div>
  );
};

export const LegalSection = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <section id={id} className="scroll-mt-28 break-inside-avoid-page">
    <h2 className="font-display text-2xl font-bold tracking-tight mb-4">{title}</h2>
    <div className="space-y-3 text-muted-foreground">{children}</div>
  </section>
);

/** Cláusula numerada ("5.3."), para referência em atendimento e disputas. */
export const Clause = ({ n, children }: { n: string; children: ReactNode }) => (
  <p>
    <strong className="text-foreground tabular-nums">{n}.</strong> {children}
  </p>
);

export const LegalList = ({ children, ordered = false }: { children: ReactNode; ordered?: boolean }) => {
  const Tag = ordered ? "ol" : "ul";
  return <Tag className={cn("space-y-1.5 pl-5", ordered ? "list-decimal" : "list-disc")}>{children}</Tag>;
};

export const Callout = ({ title, children, tone = "default" }: { title?: string; children: ReactNode; tone?: "default" | "warning" }) => (
  <div
    className={cn(
      "rounded-2xl border p-5 space-y-2",
      tone === "warning" ? "border-amber-500/40 bg-amber-500/5" : "border-primary/30 bg-primary/5",
    )}
  >
    {title && <p className="font-semibold text-foreground">{title}</p>}
    <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
  </div>
);

export const LegalTable = ({ head, rows }: { head: string[]; rows: ReactNode[][] }) => (
  <div className="overflow-x-auto rounded-xl border border-border">
    <table className="w-full text-sm">
      <thead className="bg-muted/50 text-left">
        <tr>
          {head.map((h) => (
            <th key={h} className="px-3 py-2 font-semibold text-foreground align-bottom">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((r, i) => (
          <tr key={i} className="align-top">
            {r.map((c, j) => (
              <td key={j} className="px-3 py-2 text-muted-foreground">{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const Strong = ({ children }: { children: ReactNode }) => <strong className="text-foreground">{children}</strong>;
