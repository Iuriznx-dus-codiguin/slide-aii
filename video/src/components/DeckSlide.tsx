import type { CSSProperties, ReactNode } from "react";
import { FONT } from "../theme";

// A sample deck ("Café Raiz", a fictional coffee shop) drawn the way SlideAI
// themes its output: its own palette and a display serif, separate from the
// violet product UI. Every slide is authored at 960x540 and scaled by parents.

export const SLIDE_W = 960;
export const SLIDE_H = 540;

const D = {
  cream: "#F6EFE4",
  creamDeep: "#EADFCD",
  green: "#1F3B2C",
  greenSoft: "#2E5640",
  terracotta: "#C9653C",
  brown: "#3B2A20",
  sage: "#8FAE8B",
  ink: "#24201C",
  inkMuted: "#6E655B",
};

const serif = FONT.serif;

const Frame = ({ bg, children, style }: { bg: string; children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      width: SLIDE_W,
      height: SLIDE_H,
      background: bg,
      position: "relative",
      overflow: "hidden",
      fontFamily: FONT.sans,
      color: D.ink,
      ...style,
    }}
  >
    {children}
  </div>
);

const Kicker = ({ children, color = D.terracotta }: { children: ReactNode; color?: string }) => (
  <div
    style={{
      fontFamily: FONT.mono,
      fontSize: 15,
      letterSpacing: 3,
      textTransform: "uppercase",
      color,
      fontWeight: 700,
    }}
  >
    {children}
  </div>
);

const Title = ({ children, color = D.green, size = 54 }: { children: ReactNode; color?: string; size?: number }) => (
  <div style={{ fontFamily: serif, fontWeight: 800, fontSize: size, lineHeight: 1.04, color, letterSpacing: -0.5 }}>
    {children}
  </div>
);

const PageNo = ({ n, color = D.inkMuted }: { n: number; color?: string }) => (
  <div
    style={{
      position: "absolute",
      right: 40,
      bottom: 30,
      fontFamily: FONT.mono,
      fontSize: 14,
      color,
      letterSpacing: 2,
    }}
  >
    {String(n).padStart(2, "0")} / 08
  </div>
);

const Bean = ({ x, y, s, r, color }: { x: number; y: number; s: number; r: number; color: string }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: s,
      height: s * 1.35,
      borderRadius: "50%",
      background: color,
      rotate: `${r}deg`,
    }}
  >
    <div
      style={{
        position: "absolute",
        left: "47%",
        top: "12%",
        width: "6%",
        height: "76%",
        borderRadius: 999,
        background: "rgba(0,0,0,0.22)",
        rotate: "8deg",
      }}
    />
  </div>
);

export const REVENUE = [
  { year: "2026", value: 120 },
  { year: "2027", value: 260 },
  { year: "2028", value: 410 },
  { year: "2029", value: 640 },
];

// chartProgress 0..1 grows the bars. chartMode "bullets" is the before-state
// used in the chat-edit scene.
export const RevenueSlide = ({
  chartProgress = 1,
  bulletsOpacity = 0,
  chartOpacity = 1,
}: {
  chartProgress?: number;
  bulletsOpacity?: number;
  chartOpacity?: number;
}) => {
  const max = 640;
  return (
    <Frame bg={D.cream}>
      <div style={{ position: "absolute", left: 56, top: 48 }}>
        <Kicker>Mercado</Kicker>
        <div style={{ height: 12 }} />
        <Title>Projeção de receita</Title>
      </div>

      {/* Before: plain bullet list */}
      <div style={{ position: "absolute", left: 56, top: 190, opacity: bulletsOpacity }}>
        {REVENUE.map((r) => (
          <div key={r.year} style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 22 }}>
            <div style={{ width: 10, height: 10, borderRadius: 99, background: D.terracotta }} />
            <div style={{ fontSize: 30, color: D.ink }}>
              {r.year}: R$ {r.value} mil
            </div>
          </div>
        ))}
      </div>

      {/* After: bar chart */}
      <div
        style={{
          position: "absolute",
          left: 56,
          right: 56,
          bottom: 70,
          height: 300,
          display: "flex",
          alignItems: "flex-end",
          gap: 44,
          opacity: chartOpacity,
        }}
      >
        {REVENUE.map((r, i) => {
          const local = Math.min(1, Math.max(0, chartProgress * 1.6 - i * 0.2));
          const h = (r.value / max) * 230 * local;
          return (
            <div key={r.year} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{ fontFamily: FONT.mono, fontSize: 20, fontWeight: 700, color: D.green, opacity: local }}>
                R$ {r.value} mil
              </div>
              <div
                style={{
                  width: "100%",
                  height: h,
                  borderRadius: "12px 12px 4px 4px",
                  background: i === REVENUE.length - 1 ? D.terracotta : D.greenSoft,
                }}
              />
              <div style={{ fontFamily: FONT.mono, fontSize: 18, color: D.inkMuted }}>{r.year}</div>
            </div>
          );
        })}
      </div>
      <PageNo n={3} />
    </Frame>
  );
};

const TitleSlide = () => (
  <Frame bg={`radial-gradient(circle at 78% 40%, ${D.greenSoft}, ${D.green} 60%)`}>
    <Bean x={640} y={90} s={120} r={-24} color={D.terracotta} />
    <Bean x={770} y={250} s={90} r={18} color={D.sage} />
    <Bean x={600} y={300} s={70} r={40} color={D.creamDeep} />
    <Bean x={820} y={60} s={54} r={-50} color={D.sage} />
    <div style={{ position: "absolute", left: 60, top: 150 }}>
      <Kicker color={D.sage}>Pitch · 2026</Kicker>
      <div style={{ height: 18 }} />
      <Title color={D.cream} size={104}>
        Café Raiz
      </Title>
      <div style={{ height: 22 }} />
      <div style={{ fontSize: 28, color: D.creamDeep, maxWidth: 480, lineHeight: 1.3 }}>
        A cafeteria sustentável do grão ao copo
      </div>
    </div>
    <PageNo n={1} color={D.sage} />
  </Frame>
);

const ProblemSlide = () => {
  const items = ["Copos descartáveis no balcão", "Grão sem origem conhecida", "Borra de café vai para o lixo"];
  return (
    <Frame bg={D.cream}>
      <div style={{ position: "absolute", left: 56, top: 48 }}>
        <Kicker>O problema</Kicker>
        <div style={{ height: 12 }} />
        <Title>O café de todo dia gera lixo</Title>
      </div>
      <div style={{ position: "absolute", left: 56, right: 56, top: 220, display: "flex", flexDirection: "column", gap: 22 }}>
        {items.map((t, i) => (
          <div
            key={t}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 22,
              padding: "16px 22px",
              borderRadius: 16,
              background: i === 0 ? D.creamDeep : "transparent",
              border: `2px solid ${D.creamDeep}`,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: D.terracotta,
                color: D.cream,
                fontFamily: FONT.mono,
                fontWeight: 700,
                fontSize: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {i + 1}
            </div>
            <div style={{ fontSize: 28, color: D.ink, fontWeight: 600 }}>{t}</div>
          </div>
        ))}
      </div>
      <PageNo n={2} />
    </Frame>
  );
};

const ModelSlide = () => {
  const cards = [
    { t: "Grão direto do produtor", d: "Origem rastreada por QR code" },
    { t: "Copo retornável", d: "Caução de R$ 5, devolve na loja" },
    { t: "Borra vira adubo", d: "Parceria com hortas urbanas" },
  ];
  return (
    <Frame bg={D.green}>
      <div style={{ position: "absolute", left: 56, top: 48 }}>
        <Kicker color={D.sage}>Modelo</Kicker>
        <div style={{ height: 12 }} />
        <Title color={D.cream}>Como funciona</Title>
      </div>
      <div style={{ position: "absolute", left: 56, right: 56, bottom: 70, display: "flex", gap: 24 }}>
        {cards.map((c, i) => (
          <div
            key={c.t}
            style={{
              flex: 1,
              height: 230,
              borderRadius: 20,
              background: i === 1 ? D.terracotta : D.greenSoft,
              padding: 26,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontFamily: serif, fontSize: 52, fontWeight: 900, color: D.cream, opacity: 0.5 }}>0{i + 1}</div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, color: D.cream, lineHeight: 1.15 }}>{c.t}</div>
              <div style={{ height: 8 }} />
              <div style={{ fontSize: 18, color: D.creamDeep, lineHeight: 1.3 }}>{c.d}</div>
            </div>
          </div>
        ))}
      </div>
      <PageNo n={4} color={D.sage} />
    </Frame>
  );
};

const Cup = () => (
  <div style={{ position: "absolute", left: 120, top: 150, width: 230, height: 260 }}>
    {/* steam */}
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          left: 50 + i * 50,
          top: -10,
          width: 16,
          height: 80,
          borderRadius: 99,
          border: `5px solid ${D.cream}`,
          borderLeftColor: "transparent",
          borderBottomColor: "transparent",
          opacity: 0.6,
          rotate: `${i % 2 === 0 ? 12 : -12}deg`,
        }}
      />
    ))}
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 90,
        width: 200,
        height: 150,
        background: D.cream,
        borderRadius: "16px 16px 90px 90px",
      }}
    />
    <div
      style={{
        position: "absolute",
        left: 176,
        top: 120,
        width: 70,
        height: 70,
        borderRadius: 99,
        border: `16px solid ${D.cream}`,
      }}
    />
    <div style={{ position: "absolute", left: 14, top: 98, width: 172, height: 20, borderRadius: 99, background: D.brown }} />
    <div style={{ position: "absolute", left: -30, top: 236, width: 260, height: 18, borderRadius: 99, background: D.creamDeep }} />
  </div>
);

const ExperienceSlide = () => (
  <Frame bg={D.cream}>
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 460,
        background: `linear-gradient(160deg, ${D.terracotta}, #A64E2C)`,
      }}
    >
      <Cup />
    </div>
    <div style={{ position: "absolute", left: 510, top: 120, right: 50 }}>
      <Kicker>Experiência</Kicker>
      <div style={{ height: 14 }} />
      <Title size={50}>Balcão sem descartáveis</Title>
      <div style={{ height: 20 }} />
      <div style={{ fontSize: 24, color: D.inkMuted, lineHeight: 1.4 }}>
        Cada xícara mostra de qual fazenda veio o grão.
      </div>
    </div>
    <PageNo n={5} />
  </Frame>
);

const NumbersSlide = () => {
  const kpis = [
    { v: "3", u: "lojas", d: "até 2027" },
    { v: "R$ 640 mil", u: "", d: "receita em 2029" },
    { v: "18", u: "meses", d: "de payback" },
  ];
  return (
    <Frame bg={D.creamDeep}>
      <div style={{ position: "absolute", left: 56, top: 48 }}>
        <Kicker>Números</Kicker>
        <div style={{ height: 12 }} />
        <Title>Metas da rodada</Title>
      </div>
      <div style={{ position: "absolute", left: 56, right: 56, bottom: 80, display: "flex", gap: 24 }}>
        {kpis.map((k) => (
          <div key={k.d} style={{ flex: 1, borderTop: `4px solid ${D.terracotta}`, paddingTop: 22 }}>
            <div style={{ fontFamily: serif, fontWeight: 900, fontSize: 48, color: D.green, lineHeight: 1, whiteSpace: "nowrap" }}>
              {k.v}
              {k.u ? <span style={{ fontSize: 28, fontWeight: 600 }}> {k.u}</span> : null}
            </div>
            <div style={{ height: 10 }} />
            <div style={{ fontSize: 22, color: D.inkMuted }}>{k.d}</div>
          </div>
        ))}
      </div>
      <PageNo n={6} />
    </Frame>
  );
};

const RoadmapSlide = () => {
  const steps = [
    { y: "2026", t: "Loja-piloto" },
    { y: "2027", t: "Mais 2 lojas" },
    { y: "2028", t: "Assinatura de grãos" },
  ];
  return (
    <Frame bg={D.cream}>
      <div style={{ position: "absolute", left: 56, top: 48 }}>
        <Kicker>Próximos passos</Kicker>
        <div style={{ height: 12 }} />
        <Title>Roadmap</Title>
      </div>
      <div style={{ position: "absolute", left: 90, right: 90, top: 330, height: 4, background: D.creamDeep }} />
      <div style={{ position: "absolute", left: 90, width: "45%", top: 330, height: 4, background: D.terracotta }} />
      <div style={{ position: "absolute", left: 56, right: 56, top: 300, display: "flex", justifyContent: "space-between" }}>
        {steps.map((s, i) => (
          <div key={s.y} style={{ width: 240, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 99,
                background: i === 0 ? D.terracotta : D.green,
                border: `6px solid ${D.cream}`,
              }}
            />
            <div style={{ fontFamily: FONT.mono, fontSize: 22, fontWeight: 700, color: D.terracotta }}>{s.y}</div>
            <div style={{ fontSize: 26, fontWeight: 600, color: D.ink, textAlign: "center" }}>{s.t}</div>
          </div>
        ))}
      </div>
      <PageNo n={7} />
    </Frame>
  );
};

const ClosingSlide = () => (
  <Frame bg={`linear-gradient(140deg, ${D.terracotta}, #9E4524)`}>
    <Bean x={700} y={-40} s={200} r={-30} color="rgba(255,255,255,0.12)" />
    <Bean x={800} y={300} s={140} r={24} color="rgba(0,0,0,0.12)" />
    <div style={{ position: "absolute", left: 60, top: 170 }}>
      <Kicker color={D.cream}>Rodada seed</Kicker>
      <div style={{ height: 18 }} />
      <Title color={D.cream} size={92}>
        Vamos conversar?
      </Title>
      <div style={{ height: 20 }} />
      <div style={{ fontSize: 28, color: D.creamDeep }}>Captação de R$ 1,2 milhão</div>
    </div>
    <PageNo n={8} color={D.creamDeep} />
  </Frame>
);

export const DECK = [
  TitleSlide,
  ProblemSlide,
  () => <RevenueSlide />,
  ModelSlide,
  ExperienceSlide,
  NumbersSlide,
  RoadmapSlide,
  ClosingSlide,
];

// Renders slide `index` scaled to `width` px wide.
export const ScaledSlide = ({
  index,
  width,
  style,
  children,
}: {
  index?: number;
  width: number;
  style?: CSSProperties;
  children?: ReactNode;
}) => {
  const s = width / SLIDE_W;
  const Slide = index === undefined ? null : DECK[index];
  return (
    <div style={{ width, height: SLIDE_H * s, position: "relative", overflow: "hidden", ...style }}>
      <div style={{ position: "absolute", left: 0, top: 0, scale: String(s), transformOrigin: "0 0" }}>
        {Slide ? <Slide /> : children}
      </div>
    </div>
  );
};
