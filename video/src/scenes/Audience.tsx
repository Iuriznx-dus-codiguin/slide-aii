import { AbsoluteFill, useCurrentFrame } from "remotion";
import { beatPulse, enter, tw, useIsPortrait } from "../anim";
import { LightBg } from "../bg/LightBg";
import { Slide, type DeckId } from "../decks/Decks";
import { Sparkle } from "../mg/Sparkle";
import { SlotWord, Words } from "../mg/Text";
import { EASE, FONT, GRADIENT, gradientText } from "../theme";
import { MOMENTS } from "../timeline";

// 22.8–30 s. Connect: the viewer finds their own use case. The word rolls like
// a slot machine every three beats and the deck cover flips to match.

const ITEMS: { word: string; deck: DeckId; thumbs: number[] }[] = [
  { word: "aula.", deck: "aula", thumbs: [2, 3] },
  { word: "TCC.", deck: "tcc", thumbs: [1, 2] },
  { word: "reunião.", deck: "reuniao", thumbs: [1, 2] },
  { word: "pitch.", deck: "pitch", thumbs: [2, 3] },
];

// 16:9: purple panel on the left, deck on the right. 9:16: purple panel on
// top, deck below with its other slides stacked behind the cover.
const GEO = {
  landscape: { panel: { left: 0, top: 0, width: 900, height: 1080 }, text: { left: 140, top: 330 }, cover: { x: 1000, y: 210, w: 820 } },
  portrait: { panel: { left: 0, top: 0, width: 1080, height: 860 }, text: { left: 70, top: 280 }, cover: { x: 90, y: 960, w: 900 } },
};

export const Audience = () => {
  const frame = useCurrentFrame();
  const swaps = MOMENTS.audienceSwaps;
  const idx = swaps.filter((s) => frame >= s).length - 1;
  const local = frame - swaps[idx];
  const pulse = beatPulse(frame, 5);

  // Card flip around each swap: old turns away, new turns in.
  const flipIn = idx === 0 ? enter(frame, 6, 18, EASE.outBack) : tw(local, [0, 14], [0, 1], EASE.outBack);
  const nextSwap = swaps[idx + 1];
  const flipOut = nextSwap === undefined ? 0 : tw(frame, [nextSwap - 7, nextSwap], [0, 1], EASE.inQuad);
  const angle = (1 - flipIn) * -90 + flipOut * 90;
  const item = ITEMS[idx];
  const portrait = useIsPortrait();
  const G = portrait ? GEO.portrait : GEO.landscape;
  const COVER = G.cover;
  const thumbP = (i: number) => tw(local, [8 + i * 5, 24 + i * 5], [0, 1], EASE.outExpo) * (1 - flipOut);

  return (
    <AbsoluteFill>
      <LightBg shapes={false} />

      {/* 9:16: the deck's other slides fan out behind the cover */}
      {portrait
        ? item.thumbs.map((t, i) => {
            const p = thumbP(i);
            return (
              <div
                key={`${item.deck}-${t}`}
                style={{
                  position: "absolute",
                  left: COVER.x + (i === 0 ? -20 : 40),
                  top: COVER.y + 40,
                  opacity: p,
                  rotate: `${(i === 0 ? -7 : 6) * p}deg`,
                  translate: `0 ${p * (i === 0 ? 70 : 100)}px`,
                  borderRadius: 18,
                  boxShadow: "0 30px 60px -20px hsl(252 60% 30% / 0.45)",
                }}
              >
                <Slide deck={item.deck} index={t} width={COVER.w - 60} radius={18} />
              </div>
            );
          })
        : null}

      {/* Deck cover flipping + thumbnails */}
      <div style={{ position: "absolute", left: COVER.x, top: COVER.y, perspective: 1800 }}>
        <div
          style={{
            rotate: `y ${angle}deg`,
            borderRadius: 22,
            boxShadow: "0 50px 110px -30px hsl(252 80% 30% / 0.5), 0 0 0 3px hsl(252 100% 88%)",
            scale: String(1 + pulse * 0.012),
          }}
        >
          <Slide deck={item.deck} index={0} width={COVER.w} radius={22} />
        </div>
      </div>
      <div style={{ position: "absolute", left: COVER.x, top: COVER.y + COVER.w * 0.5625 + 44, display: portrait ? "none" : "flex", gap: 28 }}>
        {item.thumbs.map((t, i) => {
          const p = thumbP(i);
          return (
            <div key={`${item.deck}-${t}`} style={{ opacity: p, translate: `0 ${(1 - p) * 60}px`, borderRadius: 14, boxShadow: "0 20px 40px -16px hsl(252 60% 30% / 0.45)" }}>
              <Slide deck={item.deck} index={t} width={396} radius={14} />
            </div>
          );
        })}
      </div>

      {/* Purple panel with the rolling word */}
      <div style={{ position: "absolute", ...G.panel, background: GRADIENT.hero, overflow: "hidden" }}>
        <AbsoluteFill
          style={{
            backgroundImage: "linear-gradient(hsl(0 0% 100% / 0.1) 2px, transparent 2px), linear-gradient(90deg, hsl(0 0% 100% / 0.1) 2px, transparent 2px)",
            backgroundSize: "90px 90px",
            backgroundPosition: `${frame * 0.8}px ${frame * 0.4}px`,
          }}
        />
        <div style={{ position: "absolute", right: -120, bottom: -140, opacity: 0.25, rotate: `${frame * 0.8}deg` }}>
          <Sparkle size={560} color="#fff" />
        </div>
        <div style={{ position: "absolute", ...G.text }}>
          <Words tokens={["Para", "sua"]} at={4} stagger={5} dur={18} mode="rise" style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 140, letterSpacing: -5, color: "#fff", lineHeight: 1 }} />
          <div
            style={{
              marginTop: 26,
              display: "inline-block",
              padding: "0 40px",
              borderRadius: 34,
              background: "#fff",
              boxShadow: "0 30px 70px -20px hsl(252 100% 20% / 0.6)",
              scale: String(enter(frame, 12, 16, EASE.outBack) * (1 + pulse * 0.02)),
              transformOrigin: "0% 50%",
            }}
          >
            <SlotWord
              words={ITEMS.map((x) => x.word)}
              switches={swaps}
              lineHeight={190}
              render={(w) => <span style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 140, letterSpacing: -5, ...gradientText(GRADIENT.ink) }}>{w}</span>}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
