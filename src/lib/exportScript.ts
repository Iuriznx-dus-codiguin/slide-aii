// Exporta o roteiro de falas (presenters_data) em PDF e DOCX.
// Cada slide gera uma seção com numeração, headline, e blocos por apresentador
// com fala + contagem de palavras + âncora de transição.
import { jsPDF } from "jspdf";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak,
} from "docx";

export interface ScriptPresenter {
  name: string;
  exact_speech?: string;
  transition_anchor?: string;
}
export interface ScriptSlide {
  headline?: string;
  presenters_data?: ScriptPresenter[];
}

const wc = (s?: string) => (s || "").trim().split(/\s+/).filter(Boolean).length;
const safeName = (t: string) =>
  t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "roteiro";

/* -------------------------- PDF -------------------------- */
export function exportScriptToPdf(title: string, slides: ScriptSlide[]) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const MARGIN = 48;
  let y = MARGIN;

  const ensure = (need: number) => {
    if (y + need > H - MARGIN) { pdf.addPage(); y = MARGIN; }
  };
  const writeWrapped = (text: string, size: number, opts: { bold?: boolean; color?: [number, number, number]; indent?: number; lineGap?: number } = {}) => {
    pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...(opts.color ?? [30, 30, 30]));
    const indent = opts.indent ?? 0;
    const lines = pdf.splitTextToSize(text, W - MARGIN * 2 - indent);
    const lh = size * 1.35;
    lines.forEach((ln: string) => {
      ensure(lh);
      pdf.text(ln, MARGIN + indent, y);
      y += lh;
    });
    y += opts.lineGap ?? 0;
  };

  // Capa
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(24);
  pdf.setTextColor(20, 20, 20);
  pdf.text(title, MARGIN, y);
  y += 32;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(120, 120, 120);
  pdf.text(`Roteiro de falas — ${slides.length} slide${slides.length === 1 ? "" : "s"}`, MARGIN, y);
  y += 24;
  pdf.setDrawColor(168, 85, 247);
  pdf.setLineWidth(2);
  pdf.line(MARGIN, y, MARGIN + 60, y);
  y += 24;

  slides.forEach((s, i) => {
    ensure(80);
    // Header de slide
    pdf.setFillColor(245, 240, 255);
    pdf.rect(MARGIN, y - 4, W - MARGIN * 2, 28, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(108, 43, 217);
    pdf.text(`SLIDE ${i + 1}`, MARGIN + 8, y + 14);
    pdf.setTextColor(40, 40, 40);
    const headline = s.headline ?? "(sem título)";
    pdf.text(headline, MARGIN + 80, y + 14, { maxWidth: W - MARGIN * 2 - 90 });
    y += 38;

    const presenters = s.presenters_data ?? [];
    if (presenters.length === 0) {
      writeWrapped("(Sem falas atribuídas)", 10, { color: [140, 140, 140], indent: 8, lineGap: 8 });
      y += 6;
      return;
    }

    presenters.forEach((p) => {
      const speakWc = wc(p.exact_speech);
      ensure(40);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(60, 60, 60);
      pdf.text(`▸ ${p.name || "Apresentador"}`, MARGIN, y);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(150, 150, 150);
      pdf.text(`${speakWc} palavras`, W - MARGIN, y, { align: "right" });
      y += 16;

      if (p.transition_anchor) {
        writeWrapped(`↪ ${p.transition_anchor}`, 9.5, { color: [120, 120, 120], indent: 14, lineGap: 4 });
      }
      if (p.exact_speech) {
        writeWrapped(p.exact_speech, 11, { color: [25, 25, 25], indent: 14, lineGap: 8 });
      } else {
        writeWrapped("— (silêncio neste slide)", 9.5, { color: [180, 180, 180], indent: 14, lineGap: 6 });
      }
    });
    y += 12;
  });

  pdf.save(`${safeName(title)}-roteiro.pdf`);
}

/* -------------------------- DOCX -------------------------- */
export async function exportScriptToDocx(title: string, slides: ScriptSlide[]) {
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: title, bold: true, size: 48 })],
    }),
    new Paragraph({
      children: [new TextRun({
        text: `Roteiro de falas — ${slides.length} slide${slides.length === 1 ? "" : "s"}`,
        italics: true, color: "888888", size: 22,
      })],
      spacing: { after: 360 },
    }),
  ];

  slides.forEach((s, i) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 360, after: 120 },
        children: [
          new TextRun({ text: `SLIDE ${i + 1}  `, bold: true, color: "6C2BD9", size: 26 }),
          new TextRun({ text: s.headline ?? "(sem título)", bold: true, size: 26 }),
        ],
      }),
    );
    const presenters = s.presenters_data ?? [];
    if (presenters.length === 0) {
      children.push(new Paragraph({ children: [new TextRun({ text: "(Sem falas atribuídas)", italics: true, color: "999999" })] }));
      return;
    }
    presenters.forEach((p) => {
      const w = wc(p.exact_speech);
      children.push(new Paragraph({
        spacing: { before: 200, after: 60 },
        children: [
          new TextRun({ text: `▸ ${p.name || "Apresentador"}  `, bold: true, size: 24 }),
          new TextRun({ text: `(${w} palavras)`, size: 18, color: "999999" }),
        ],
      }));
      if (p.transition_anchor) {
        children.push(new Paragraph({
          indent: { left: 360 },
          children: [new TextRun({ text: `↪ ${p.transition_anchor}`, italics: true, color: "777777", size: 20 })],
        }));
      }
      if (p.exact_speech) {
        children.push(new Paragraph({
          indent: { left: 360 },
          spacing: { after: 120 },
          children: [new TextRun({ text: p.exact_speech, size: 22 })],
        }));
      } else {
        children.push(new Paragraph({
          indent: { left: 360 },
          children: [new TextRun({ text: "— (silêncio neste slide)", italics: true, color: "BBBBBB", size: 20 })],
        }));
      }
    });
  });

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName(title)}-roteiro.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
