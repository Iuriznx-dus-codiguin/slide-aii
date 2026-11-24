import type { CSSProperties, ReactNode } from "react";
import { DECK as CAFE_DECK } from "../components/DeckSlide";
import { FONT } from "../theme";

// Sample decks shown in the ad, one per audience. Content is illustrative
// (fictional school, thesis and company) and drawn at 960x540, then scaled.

export const SW = 960;
export const SH = 540;

type Theme = { bg: string; ink: string; muted: string; accent: string; accent2: string; soft: string; display: string };

const SOLAR: Theme = { bg: "#FFFBF2", ink: "#1D2B44", muted: "#5B6478", accent: "#F59E0B", accent2: "#0EA5E9", soft: "#FEF0C7", display: FONT.sans };
const TCC: Theme = { bg: "#FFFFFF", ink: "#14213D", muted: "#5C6784", accent: "#2E5BFF", accent2: "#14213D", soft: "#EEF2FF", display: FONT.serif };
const REPORT: Theme = { bg: "#0E1628", ink: "#F4F7FB", muted: "#93A0B8", accent: "#22C55E", accent2: "#38BDF8", soft: "#17223A", display: FONT.sans };

const Frame = ({ th, children, style }: { th: Theme; children: ReactNode; style?: CSSProperties }) => (
  <div style={{ width: SW, height: SH, background: th.bg, color: th.ink, position: "relative", overflow: "hidden", fontFamily: FONT.sans, ...style }}>{children}</div>
);

const Kicker = ({ th, children }: { th: Theme; children: ReactNode }) => (
  <div style={{ fontFamily: FONT.mono, fontSize: 15, letterSpacing: 3, textTransform: "uppercase", color: th.accent, fontWeight: 700 }}>{children}</div>
);

const Title = ({ th, children, size = 50 }: { th: Theme; children: ReactNode; size?: number }) => (
  <div style={{ fontFamily: th.display, fontWeight: 800, fontSize: size, lineHeight: 1.04, letterSpacing: -0.8, color: th.ink }}>{children}</div>
);

const Head = ({ th, k, t }: { th: Theme; k: string; t: string }) => (
  <div style={{ position: "absolute", left: 56, top: 46, right: 56 }}>
    <Kicker th={th}>{k}</Kicker>
    <div style={{ height: 10 }} />
    <Title th={th}>{t}</Title>
  </div>
);

const Page = ({ th, n, total }: { th: Theme; n: number; total: number }) => (
  <div style={{ position: "absolute", right: 36, bottom: 26, fontFamily: FONT.mono, fontSize: 14, color: th.muted, letterSpacing: 2 }}>
    {String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}
  </div>
);

const Sun = ({ x, y, r }: { x: number; y: number; r: number }) => (
  <div style={{ position: "absolute", left: x - r * 1.9, top: y - r * 1.9, width: r * 3.8, height: r * 3.8 }}>
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: "50%",
        background: "repeating-conic-gradient(#FBBF24 0deg 7deg, transparent 7deg 22deg)",
        maskImage: "radial-gradient(circle, transparent 46%, black 47%, transparent 70%)",
        WebkitMaskImage: "radial-gradient(circle, transparent 46%, black 47%, transparent 70%)",
      }}
    />
    <div style={{ position: "absolute", left: r * 0.9, top: r * 0.9, width: r * 2, height: r * 2, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #FDE68A, #F59E0B)" }} />
  </div>
);

const Panel = ({ w = 150, tilt = 0 }: { w?: number; tilt?: number }) => (
  <div
    style={{
      width: w,
      height: w * 0.62,
      borderRadius: 8,
      background: "linear-gradient(135deg, #1E3A8A, #2563EB)",
      backgroundImage:
        "linear-gradient(rgba(255,255,255,0.35) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.35) 2px, transparent 2px), linear-gradient(135deg, #1E3A8A, #2563EB)",
      backgroundSize: `${w / 4}px ${(w * 0.62) / 3}px, ${w / 4}px ${(w * 0.62) / 3}px, 100% 100%`,
      border: "3px solid #CBD5E1",
      transform: `skewX(${tilt}deg)`,
    }}
  />
);

// ---------- Aula: Energia solar (8 slides) ----------

const S1 = () => (
  <Frame th={SOLAR} style={{ background: "linear-gradient(160deg, #FFF7E6 0%, #FFE8B8 100%)" }}>
    <Sun x={760} y={170} r={80} />
    <div style={{ position: "absolute", left: -60, right: -60, bottom: -120, height: 260, borderRadius: "50%", background: "#9BD18B" }} />
    <div style={{ position: "absolute", left: 400, right: -100, bottom: -170, height: 260, borderRadius: "50%", background: "#6FB86A" }} />
    <div style={{ position: "absolute", left: 60, top: 140 }}>
      <Kicker th={SOLAR}>Ciências · 9º ano</Kicker>
      <div style={{ height: 14 }} />
      <Title th={SOLAR} size={96}>
        Energia
        <br />
        solar
      </Title>
      <div style={{ height: 16 }} />
      <div style={{ fontSize: 26, color: SOLAR.muted, maxWidth: 440 }}>Como a luz do Sol vira eletricidade</div>
    </div>
    <Page th={SOLAR} n={1} total={8} />
  </Frame>
);

const S2 = () => (
  <Frame th={SOLAR}>
    <Head th={SOLAR} k="O que é" t="Luz que vira energia" />
    <div style={{ position: "absolute", left: 56, top: 220, width: 470, fontSize: 28, lineHeight: 1.45, color: SOLAR.muted }}>
      Painéis <b style={{ color: SOLAR.ink }}>fotovoltaicos</b> transformam a luz do Sol em corrente elétrica, sem queimar nada.
    </div>
    <div style={{ position: "absolute", right: 70, top: 200 }}>
      <Sun x={150} y={30} r={40} />
      <div style={{ marginTop: 120 }}>
        <Panel w={300} />
      </div>
    </div>
    <Page th={SOLAR} n={2} total={8} />
  </Frame>
);

const Node = ({ label, sub, children }: { label: string; sub: string; children: ReactNode }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: 170 }}>
    <div style={{ width: 120, height: 120, borderRadius: 30, background: SOLAR.soft, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
    <div style={{ fontSize: 24, fontWeight: 800 }}>{label}</div>
    <div style={{ fontFamily: FONT.mono, fontSize: 15, color: SOLAR.muted, textAlign: "center" }}>{sub}</div>
  </div>
);

const Arrow = () => (
  <svg width="54" height="24" viewBox="0 0 54 24" style={{ marginTop: 48 }}>
    <path d="M2 12 H46 M36 3 L48 12 L36 21" fill="none" stroke={SOLAR.accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const S3 = () => (
  <Frame th={SOLAR}>
    <Head th={SOLAR} k="Como funciona" t="Do Sol até a tomada" />
    <div style={{ position: "absolute", left: 40, right: 40, top: 230, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <Node label="Sol" sub="luz">
        <div style={{ width: 64, height: 64, borderRadius: 99, background: "radial-gradient(circle at 35% 35%, #FDE68A, #F59E0B)" }} />
      </Node>
      <Arrow />
      <Node label="Painel" sub="corrente contínua">
        <Panel w={84} />
      </Node>
      <Arrow />
      <Node label="Inversor" sub="corrente alternada">
        <div style={{ width: 62, height: 70, borderRadius: 10, background: "#334155", border: "4px solid #94A3B8" }} />
      </Node>
      <Arrow />
      <Node label="Casa" sub="uso">
        <svg width="70" height="64" viewBox="0 0 70 64">
          <path d="M6 30 L35 6 L64 30 V60 H6 Z" fill={SOLAR.accent2} />
          <rect x="28" y="38" width="14" height="22" fill="#fff" />
        </svg>
      </Node>
    </div>
    <Page th={SOLAR} n={3} total={8} />
  </Frame>
);

const DAY = [
  { h: "6h", v: 0.1 },
  { h: "8h", v: 0.45 },
  { h: "10h", v: 0.8 },
  { h: "12h", v: 1 },
  { h: "14h", v: 0.86 },
  { h: "16h", v: 0.5 },
  { h: "18h", v: 0.12 },
];

export const SolarChart = ({ progress = 1 }: { progress?: number }) => (
  <Frame th={SOLAR}>
    <Head th={SOLAR} k="Ao longo do dia" t="Pico de geração ao meio-dia" />
    <div style={{ position: "absolute", left: 70, right: 70, bottom: 64, height: 290, display: "flex", alignItems: "flex-end", gap: 26 }}>
      {DAY.map((d, i) => {
        const p = Math.min(1, Math.max(0, progress * 1.8 - i * 0.12));
        return (
          <div key={d.h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ width: "100%", height: 240 * d.v * p, borderRadius: "12px 12px 4px 4px", background: i === 3 ? SOLAR.accent : "#FCD34D" }} />
            <div style={{ fontFamily: FONT.mono, fontSize: 18, color: SOLAR.muted }}>{d.h}</div>
          </div>
        );
      })}
    </div>
    <Page th={SOLAR} n={4} total={8} />
  </Frame>
);

const S5 = () => (
  <Frame th={SOLAR}>
    <Head th={SOLAR} k="Vantagens" t="Por que usar" />
    <div style={{ position: "absolute", left: 56, right: 56, bottom: 64, display: "flex", gap: 22 }}>
      {[
        ["Renovável", "O Sol nasce todo dia"],
        ["Silenciosa", "Sem motor, sem ruído"],
        ["Pouca manutenção", "Limpeza dos painéis"],
      ].map(([t, d], i) => (
        <div key={t} style={{ flex: 1, height: 230, borderRadius: 22, padding: 26, background: i === 0 ? SOLAR.accent : SOLAR.soft, color: i === 0 ? "#fff" : SOLAR.ink, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>{t}</div>
          <div style={{ height: 8 }} />
          <div style={{ fontSize: 19, opacity: 0.8 }}>{d}</div>
        </div>
      ))}
    </div>
    <Page th={SOLAR} n={5} total={8} />
  </Frame>
);

export const SolarRoof = () => (
  <Frame th={SOLAR} style={{ background: "linear-gradient(180deg, #BAE6FD 0%, #E0F2FE 70%)" }}>
    <Sun x={820} y={110} r={56} />
    <div style={{ position: "absolute", left: 90, bottom: 0, width: 520, height: 230, background: "#F8FAFC", borderRadius: "6px 6px 0 0" }} />
    <div style={{ position: "absolute", left: 50, bottom: 220, width: 600, height: 150, background: "#B45309", clipPath: "polygon(8% 100%, 50% 0, 92% 100%)" }} />
    <div style={{ position: "absolute", left: 220, bottom: 252, display: "flex", gap: 10, rotate: "-0deg" }}>
      <Panel w={110} tilt={-8} />
      <Panel w={110} tilt={-8} />
    </div>
    <div style={{ position: "absolute", left: 290, bottom: 0, width: 80, height: 130, background: "#1D4ED8", borderRadius: "8px 8px 0 0" }} />
    <div style={{ position: "absolute", right: 56, top: 220, width: 300 }}>
      <Kicker th={SOLAR}>Na prática</Kicker>
      <div style={{ height: 10 }} />
      <Title th={SOLAR} size={44}>
        Painéis no telhado
      </Title>
    </div>
    <Page th={SOLAR} n={6} total={8} />
  </Frame>
);

const S7 = () => (
  <Frame th={SOLAR}>
    <Head th={SOLAR} k="Desafios" t="Nem tudo é sol" />
    <div style={{ position: "absolute", left: 56, right: 56, top: 220, display: "flex", flexDirection: "column", gap: 20 }}>
      {["Gera menos em dias nublados", "À noite precisa de bateria ou da rede"].map((t) => (
        <div key={t} style={{ display: "flex", alignItems: "center", gap: 20, padding: "20px 24px", borderRadius: 18, border: `3px solid ${SOLAR.soft}` }}>
          <div style={{ width: 16, height: 16, borderRadius: 99, background: SOLAR.accent2 }} />
          <div style={{ fontSize: 28, fontWeight: 600 }}>{t}</div>
        </div>
      ))}
    </div>
    <Page th={SOLAR} n={7} total={8} />
  </Frame>
);

const S8 = () => (
  <Frame th={SOLAR} style={{ background: SOLAR.ink }}>
    <div style={{ position: "absolute", left: 56, top: 60 }}>
      <Kicker th={SOLAR}>Quiz rápido</Kicker>
      <div style={{ height: 12 }} />
      <Title th={{ ...SOLAR, ink: "#fff" }} size={46}>
        O que o inversor faz?
      </Title>
    </div>
    <div style={{ position: "absolute", left: 56, right: 56, bottom: 60, display: "flex", flexDirection: "column", gap: 14 }}>
      {["Guarda energia para a noite", "Converte corrente contínua em alternada", "Aquece a água do chuveiro"].map((t, i) => (
        <div key={t} style={{ padding: "16px 22px", borderRadius: 16, fontSize: 24, fontWeight: 600, color: i === 1 ? SOLAR.ink : "#fff", background: i === 1 ? SOLAR.accent : "rgba(255,255,255,0.08)" }}>
          {String.fromCharCode(65 + i)}) {t}
        </div>
      ))}
    </div>
    <Page th={SOLAR} n={8} total={8} />
  </Frame>
);

// ---------- TCC ----------

const T1 = () => (
  <Frame th={TCC}>
    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 18, background: TCC.accent }} />
    <div style={{ position: "absolute", left: 70, top: 120, right: 70 }}>
      <Kicker th={TCC}>Trabalho de Conclusão de Curso</Kicker>
      <div style={{ height: 18 }} />
      <Title th={TCC} size={66}>
        Trabalho remoto e produtividade
      </Title>
      <div style={{ height: 22 }} />
      <div style={{ fontSize: 24, color: TCC.muted }}>Administração · Banca 2026</div>
    </div>
    <div style={{ position: "absolute", left: 70, bottom: 56, width: 120, height: 4, background: TCC.accent }} />
  </Frame>
);

const T2 = () => (
  <Frame th={TCC}>
    <Head th={TCC} k="Metodologia" t="Como a pesquisa foi feita" />
    <div style={{ position: "absolute", left: 56, right: 56, bottom: 70, display: "flex", gap: 20 }}>
      {["Revisão bibliográfica", "Questionário com 120 pessoas", "Análise dos dados"].map((t, i) => (
        <div key={t} style={{ flex: 1, padding: 24, borderRadius: 16, background: TCC.soft, height: 170 }}>
          <div style={{ fontFamily: FONT.serif, fontSize: 44, fontWeight: 800, color: TCC.accent }}>{i + 1}</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>{t}</div>
        </div>
      ))}
    </div>
  </Frame>
);

const T3 = () => (
  <Frame th={TCC}>
    <Head th={TCC} k="Resultados" t="Produtividade percebida" />
    <div style={{ position: "absolute", left: 56, right: 80, top: 230, display: "flex", flexDirection: "column", gap: 22 }}>
      {[
        ["Maior", 48],
        ["Igual", 34],
        ["Menor", 18],
      ].map(([l, v], i) => (
        <div key={l} style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 90, fontSize: 22, fontWeight: 700 }}>{l}</div>
          <div style={{ height: 40, width: `${(Number(v) / 48) * 70}%`, borderRadius: 10, background: i === 0 ? TCC.accent : "#C7D2FE" }} />
          <div style={{ fontFamily: FONT.mono, fontSize: 22, fontWeight: 700 }}>{v}%</div>
        </div>
      ))}
    </div>
  </Frame>
);

// ---------- Reunião ----------

const R1 = () => (
  <Frame th={REPORT}>
    <div style={{ position: "absolute", right: -80, top: -80, width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,197,94,0.35), transparent 70%)" }} />
    <div style={{ position: "absolute", left: 60, top: 150 }}>
      <Kicker th={REPORT}>Reunião de diretoria</Kicker>
      <div style={{ height: 16 }} />
      <Title th={REPORT} size={76}>
        Resultados do
        <br />
        3º trimestre
      </Title>
    </div>
    <svg width="380" height="160" viewBox="0 0 380 160" style={{ position: "absolute", right: 60, bottom: 60 }}>
      <path d="M0 140 L70 120 L140 128 L210 80 L280 66 L380 14" fill="none" stroke={REPORT.accent} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </Frame>
);

const R2 = () => (
  <Frame th={REPORT}>
    <Head th={REPORT} k="Indicadores" t="O trimestre em números" />
    <div style={{ position: "absolute", left: 56, right: 56, bottom: 80, display: "flex", gap: 22 }}>
      {[
        ["+18%", "receita"],
        ["240", "novos clientes"],
        ["72", "NPS"],
      ].map(([v, l]) => (
        <div key={l} style={{ flex: 1, padding: 24, borderRadius: 18, background: REPORT.soft }}>
          <div style={{ fontSize: 56, fontWeight: 800, color: REPORT.accent }}>{v}</div>
          <div style={{ fontSize: 22, color: REPORT.muted }}>{l}</div>
        </div>
      ))}
    </div>
  </Frame>
);

const R3 = () => (
  <Frame th={REPORT}>
    <Head th={REPORT} k="Receita mensal" t="Crescimento constante" />
    <svg width="850" height="250" viewBox="0 0 850 250" style={{ position: "absolute", left: 56, bottom: 50 }}>
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1="0" x2="850" y1={20 + i * 70} y2={20 + i * 70} stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
      ))}
      <path d="M0 220 L120 200 L240 205 L360 160 L480 140 L600 100 L720 80 L850 30" fill="none" stroke={REPORT.accent2} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </Frame>
);

export type DeckId = "aula" | "tcc" | "reuniao" | "pitch";

export const DECKS: Record<DeckId, (() => JSX.Element)[]> = {
  aula: [S1, S2, S3, () => <SolarChart />, S5, SolarRoof, S7, S8],
  tcc: [T1, T2, T3],
  reuniao: [R1, R2, R3],
  pitch: CAFE_DECK as (() => JSX.Element)[],
};

// Any slide scaled to `width`.
export const Slide = ({ deck, index, width, style, radius = 0 }: { deck: DeckId; index: number; width: number; style?: CSSProperties; radius?: number }) => {
  const s = width / SW;
  const C = DECKS[deck][index];
  return (
    <div style={{ width, height: SH * s, position: "relative", overflow: "hidden", borderRadius: radius, ...style }}>
      <div style={{ position: "absolute", left: 0, top: 0, scale: String(s), transformOrigin: "0 0" }}>
        <C />
      </div>
    </div>
  );
};

// Arbitrary slide content scaled to `width`.
export const Scaled = ({ width, children, style, radius = 0 }: { width: number; children: ReactNode; style?: CSSProperties; radius?: number }) => {
  const s = width / SW;
  return (
    <div style={{ width, height: SH * s, position: "relative", overflow: "hidden", borderRadius: radius, ...style }}>
      <div style={{ position: "absolute", left: 0, top: 0, scale: String(s), transformOrigin: "0 0" }}>{children}</div>
    </div>
  );
};
