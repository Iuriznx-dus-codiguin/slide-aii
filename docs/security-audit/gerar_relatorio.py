#!/usr/bin/env python3
"""Gera o relatório de auditoria de segurança em PDF (A4, pt-BR).

Uso (ambiente isolado, nada instalado globalmente):
    python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
    .venv/bin/python gerar_relatorio.py

Entradas:  dados_auditoria.py (achados, pontos fortes, recomendações, issues)
Saídas:    relatorio-auditoria-seguranca.pdf e issues-github.md (nesta pasta)
"""
from __future__ import annotations

import io
import os
import textwrap
from xml.sax.saxutils import escape

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib import font_manager  # noqa: E402
from matplotlib.patches import Patch  # noqa: E402
from reportlab.lib import colors  # noqa: E402
from reportlab.lib.enums import TA_LEFT  # noqa: E402
from reportlab.lib.pagesizes import A4  # noqa: E402
from reportlab.lib.styles import ParagraphStyle  # noqa: E402
from reportlab.lib.units import cm, mm  # noqa: E402
from reportlab.pdfbase import pdfmetrics  # noqa: E402
from reportlab.pdfbase.ttfonts import TTFont  # noqa: E402
from reportlab.pdfgen import canvas as rl_canvas  # noqa: E402
from reportlab.platypus import (  # noqa: E402
    BaseDocTemplate, CondPageBreak, Flowable, Frame, Image, KeepTogether, NextPageTemplate,
    PageBreak, PageTemplate, Paragraph, Preformatted, Spacer, Table, TableStyle,
)

import dados_auditoria as D  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA_PDF = os.path.join(AQUI, "relatorio-auditoria-seguranca.pdf")
SAIDA_MD = os.path.join(AQUI, "issues-github.md")

# ─────────────────────────── tipografia ───────────────────────────
FONTES = {
    "Sans": "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "Sans-Bold": "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "Sans-Italic": "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf",
    "Sans-BoldItalic": "/usr/share/fonts/truetype/liberation/LiberationSans-BoldItalic.ttf",
    "Mono": "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "Mono-Bold": "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
}
if all(os.path.exists(p) for p in FONTES.values()):
    for nome, caminho in FONTES.items():
        pdfmetrics.registerFont(TTFont(nome, caminho))
    pdfmetrics.registerFontFamily("Sans", normal="Sans", bold="Sans-Bold", italic="Sans-Italic", boldItalic="Sans-BoldItalic")
    SANS, SANS_B, SANS_I, MONO, MONO_B = "Sans", "Sans-Bold", "Sans-Italic", "Mono", "Mono-Bold"
    for p in FONTES.values():
        font_manager.fontManager.addfont(p)
    matplotlib.rcParams["font.family"] = "Liberation Sans"
else:  # fallback (sem acentos estendidos)
    SANS, SANS_B, SANS_I, MONO, MONO_B = "Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Courier", "Courier-Bold"

# ─────────────────────────── tokens de cor ───────────────────────────
INK = colors.HexColor("#111827")
BODY = colors.HexColor("#374151")
MUTED = colors.HexColor("#6B7280")
LINE = colors.HexColor("#E5E7EB")
SOFT = colors.HexColor("#F9FAFB")
CODE_BG = colors.HexColor("#F3F4F6")
SEV = {k: colors.HexColor(v) for k, v in D.CORES.items()}

PAGE_W, PAGE_H = A4
MARGEM = 2 * cm
LARGURA = PAGE_W - 2 * MARGEM
TITULO_RELATORIO = f"Relatório de Auditoria de Segurança — {D.PROJETO}"

# ─────────────────────────── estilos ───────────────────────────
def estilo(nome, **kw):
    base = dict(fontName=SANS, fontSize=9.5, leading=13.6, textColor=BODY, alignment=TA_LEFT)
    base.update(kw)
    return ParagraphStyle(nome, **base)

S = {
    "h1": estilo("h1", fontName=SANS_B, fontSize=19, leading=24, textColor=INK, spaceBefore=4, spaceAfter=10),
    "h2": estilo("h2", fontName=SANS_B, fontSize=13, leading=17, textColor=INK, spaceBefore=12, spaceAfter=6),
    "h3": estilo("h3", fontName=SANS_B, fontSize=10.5, leading=14, textColor=INK, spaceBefore=6, spaceAfter=3),
    "body": estilo("body"),
    "small": estilo("small", fontSize=8.2, leading=11.2),
    "muted": estilo("muted", fontSize=8.2, leading=11.2, textColor=MUTED),
    "cell": estilo("cell", fontSize=8.2, leading=11),
    "cellb": estilo("cellb", fontName=SANS_B, fontSize=8.2, leading=11, textColor=INK),
    "path": estilo("path", fontName=MONO, fontSize=6.9, leading=9.2, textColor=INK, wordWrap="CJK"),
    "label": estilo("label", fontName=SANS_B, fontSize=7.6, leading=10, textColor=MUTED),
    "bullet": estilo("bullet", leftIndent=12, bulletIndent=2),
    "code": estilo("code", fontName=MONO, fontSize=6.9, leading=9.0, textColor=INK),
    "issue": estilo("issue", fontName=MONO, fontSize=7.2, leading=9.6, textColor=INK),
}


def p(texto, st="body"):
    return Paragraph(escape(str(texto)), S[st])


def pm(markup, st="body"):
    """Parágrafo com marcação ReportLab já montada (texto dinâmico deve vir escapado)."""
    return Paragraph(markup, S[st])


# ─────────────────────────── componentes ───────────────────────────
class Chip(Flowable):
    """Selo arredondado de severidade (cor + texto: a cor nunca é o único sinal)."""

    def __init__(self, texto, cor, largura=None, fonte=7.0):
        super().__init__()
        self.texto = texto.upper()
        self.cor = cor
        self.fonte = fonte
        self.altura = fonte + 5.8
        minimo = pdfmetrics.stringWidth(self.texto, SANS_B, fonte) + 12
        self.largura = max(largura or 0, minimo)

    def wrap(self, *_):
        return self.largura, self.altura

    def draw(self):
        c = self.canv
        c.setFillColor(self.cor)
        c.roundRect(0, 0, self.largura, self.altura, self.altura / 2, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont(SANS_B, self.fonte)
        c.drawCentredString(self.largura / 2, (self.altura - self.fonte) / 2 + 1.3, self.texto)


class Regua(Flowable):
    def __init__(self, cor=LINE, espessura=0.8, largura=None):
        super().__init__()
        self.cor, self.esp, self.larg = cor, espessura, largura

    def wrap(self, aw, ah):
        self.larg = self.larg or aw
        return self.larg, self.esp + 2

    def draw(self):
        self.canv.setStrokeColor(self.cor)
        self.canv.setLineWidth(self.esp)
        self.canv.line(0, 1, self.larg, 1)


def titulo_secao(texto, numero=None):
    rotulo = f"{numero}. {texto}" if numero else texto
    return [CondPageBreak(5 * cm), pm(escape(rotulo), "h1"), Regua(INK, 1.2), Spacer(1, 8)]


def caixa_codigo(texto, largura=LARGURA, colunas=104):
    linhas = []
    for linha in str(texto).split("\n"):
        linhas.extend(textwrap.wrap(linha, colunas, subsequent_indent="    ", break_long_words=True,
                                    break_on_hyphens=False, replace_whitespace=False) or [""])
    t = Table([[Preformatted("\n".join(linhas), S["code"])]], colWidths=[largura])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
        ("BOX", (0, 0), (-1, -1), 0.4, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def contagem_por_severidade():
    return {s: sum(1 for a in D.ACHADOS if a["severidade"] == s) for s in D.SEVERIDADES}


# ─────────────────────────── gráficos (matplotlib) ───────────────────────────
HATCH = {"média": "////"}  # codificação secundária: alta e média são tons vizinhos


def imagem(buf, largura):
    from PIL import Image as PILImage
    w, h = PILImage.open(buf).size
    buf.seek(0)
    return Image(buf, width=largura, height=largura * h / w)


def _png(fig, dpi=220):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=dpi, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    buf.seek(0)
    return buf


def grafico_rosca():
    cont = contagem_por_severidade()
    sev = [s for s in D.SEVERIDADES if cont[s] > 0]
    valores = [cont[s] for s in sev]
    fig, ax = plt.subplots(figsize=(3.3, 2.6))
    plt.rcParams["hatch.color"] = "white"
    plt.rcParams["hatch.linewidth"] = 1.2
    fatias, _ = ax.pie(valores, colors=[D.CORES[s] for s in sev], startangle=90, counterclock=False,
                       wedgeprops=dict(width=0.36, edgecolor="white", linewidth=2.2))
    for f, s in zip(fatias, sev):
        if s in HATCH:
            f.set_hatch(HATCH[s])
    total = sum(valores)
    for f, v in zip(fatias, valores):
        ang = (f.theta2 + f.theta1) / 2
        import math
        r = 0.82
        ax.text(r * math.cos(math.radians(ang)), r * math.sin(math.radians(ang)), str(v),
                ha="center", va="center", fontsize=9, fontweight="bold", color="#111827",
                bbox=dict(boxstyle="round,pad=0.22", fc="white", ec="none"))
    ax.text(0, 0.08, str(total), ha="center", va="center", fontsize=24, fontweight="bold", color="#111827")
    ax.text(0, -0.2, "achados", ha="center", va="center", fontsize=9, color="#6B7280")
    ax.set(aspect="equal")
    legenda = [Patch(facecolor=D.CORES[s], edgecolor="white", hatch=HATCH.get(s, ""),
                     label=f"{s.capitalize()}  {cont[s]}") for s in D.SEVERIDADES]
    ax.legend(handles=legenda, loc="center left", bbox_to_anchor=(1.0, 0.5), frameon=False, fontsize=8.5,
              labelcolor="#374151", handlelength=1.4, handleheight=1.1)
    return _png(fig)


def grafico_barras():
    cats = list(D.CATEGORIAS.items())
    fig, ax = plt.subplots(figsize=(6.7, 2.55))
    plt.rcParams["hatch.color"] = "white"
    y = list(range(len(cats)))[::-1]
    esquerda = [0] * len(cats)
    for s in D.SEVERIDADES:
        vals = [sum(1 for a in D.ACHADOS if a["categoria"] == c and a["severidade"] == s) for c, _ in cats]
        if not any(vals):
            continue
        barras = ax.barh(y, vals, left=esquerda, height=0.56, color=D.CORES[s], edgecolor="white",
                         linewidth=2, hatch=HATCH.get(s, ""), label=s.capitalize())
        for b, v in zip(barras, vals):
            if v:
                ax.text(b.get_x() + b.get_width() / 2, b.get_y() + b.get_height() / 2, str(v), ha="center",
                        va="center", fontsize=8, fontweight="bold", color="white")
        esquerda = [e + v for e, v in zip(esquerda, vals)]
    for yi, tot in zip(y, esquerda):
        ax.text(tot + 0.12, yi, f"{tot}", va="center", fontsize=8.5, color="#111827", fontweight="bold")
    ax.set_yticks(y, [f"{n} · {nome}" for n, nome in cats], fontsize=8.5, color="#374151")
    ax.set_xlim(0, max(esquerda) + 1)
    ax.xaxis.set_major_locator(matplotlib.ticker.MaxNLocator(integer=True))
    ax.tick_params(axis="x", labelsize=7.5, colors="#6B7280", length=0)
    ax.tick_params(axis="y", length=0)
    ax.grid(axis="x", color="#E5E7EB", linewidth=0.8)
    ax.set_axisbelow(True)
    for lado in ("top", "right", "left"):
        ax.spines[lado].set_visible(False)
    ax.spines["bottom"].set_color("#D1D5DB")
    ax.legend(loc="lower center", bbox_to_anchor=(0.42, 1.0), ncol=5, frameon=False, fontsize=8,
              labelcolor="#374151", handlelength=1.3)
    ax.set_xlabel("Número de achados", fontsize=8, color="#6B7280")
    return _png(fig)


# ─────────────────────────── páginas ───────────────────────────
class CanvasNumerado(rl_canvas.Canvas):
    """Canvas com "Página X de Y" (duas passagens)."""

    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self._paginas = []

    def showPage(self):
        self._paginas.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._paginas)
        for estado in self._paginas:
            self.__dict__.update(estado)
            if self._pageNumber > 1:
                self._rodape(total)
            super().showPage()
        super().save()

    def _rodape(self, total):
        self.saveState()
        self.setFont(SANS, 7.6)
        self.setFillColor(MUTED)
        self.setStrokeColor(LINE)
        self.setLineWidth(0.6)
        # cabeçalho
        self.line(MARGEM, PAGE_H - MARGEM + 0.55 * cm, PAGE_W - MARGEM, PAGE_H - MARGEM + 0.55 * cm)
        self.drawString(MARGEM, PAGE_H - MARGEM + 0.75 * cm, TITULO_RELATORIO)
        self.drawRightString(PAGE_W - MARGEM, PAGE_H - MARGEM + 0.75 * cm, f"Confidencial · {D.DATA}")
        # rodapé
        self.line(MARGEM, MARGEM - 0.55 * cm, PAGE_W - MARGEM, MARGEM - 0.55 * cm)
        self.drawString(MARGEM, MARGEM - 0.95 * cm, f"Commit auditado {D.COMMIT}")
        self.drawRightString(PAGE_W - MARGEM, MARGEM - 0.95 * cm, f"Página {self._pageNumber} de {total}")
        self.restoreState()


def desenha_capa(c, _doc):
    c.saveState()
    c.setFillColor(INK)
    c.rect(0, PAGE_H - 10.2 * cm, PAGE_W, 10.2 * cm, stroke=0, fill=1)
    # faixa com as cores de severidade
    faixa = ["crítica", "alta", "média", "baixa", "ponto forte"]
    w = PAGE_W / len(faixa)
    for i, s in enumerate(faixa):
        c.setFillColor(SEV[s])
        c.rect(i * w, PAGE_H - 10.2 * cm - 0.22 * cm, w, 0.22 * cm, stroke=0, fill=1)
    c.setFillColor(colors.HexColor("#9CA3AF"))
    c.setFont(SANS_B, 9)
    c.drawString(MARGEM, PAGE_H - 3.0 * cm, "AUDITORIA DE SEGURANÇA · CÓDIGO-FONTE, HISTÓRICO E BANCO")
    c.setFillColor(colors.white)
    c.setFont(SANS_B, 27)
    c.drawString(MARGEM, PAGE_H - 4.6 * cm, "Relatório de Auditoria")
    c.drawString(MARGEM, PAGE_H - 5.75 * cm, f"de Segurança — {D.PROJETO}")
    c.setFont(SANS, 11)
    c.setFillColor(colors.HexColor("#D1D5DB"))
    c.drawString(MARGEM, PAGE_H - 7.0 * cm, f"Data: {D.DATA}    ·    Commit: {D.COMMIT}")
    c.drawString(MARGEM, PAGE_H - 7.65 * cm, f"Repositório: {D.REPOSITORIO}")
    c.setFont(SANS_I, 9)
    c.setFillColor(colors.HexColor("#9CA3AF"))
    c.drawString(MARGEM, PAGE_H - 9.1 * cm, "Valores de segredos nunca aparecem neste documento: só a impressão SHA-256 (12 caracteres).")
    c.restoreState()


def capa_flowables():
    cont = contagem_por_severidade()
    itens = []
    itens.append(Spacer(1, 9.4 * cm))
    itens.append(pm("Escopo auditado", "h2"))
    escopo = [
        "Código do commit 4890504 (branch main): 11 edge functions (Deno), 52 migrações SQL, 221 arquivos do front "
        "(React/Vite), scripts e documentação.",
        "Histórico git completo: 708 commits, todas as branches.",
        "Bundle do front (dist/): chaves embutidas e JWTs decodificados.",
        "Banco de produção (Lovable Cloud), somente leitura: RLS, políticas, grants, Storage, funções SECURITY DEFINER e "
        "triggers. Testes de lógica rodados dentro de uma transação desfeita.",
        "Fora do escopo: testes de intrusão em produção, dependências de terceiros (SCA) e infraestrutura da Lovable/Supabase.",
    ]
    for e in escopo:
        itens.append(Paragraph(escape(e), S["bullet"], bulletText="•"))
    itens.append(Spacer(1, 8))
    itens.append(pm("Nota metodológica", "h2"))
    itens.append(p(
        "Detectei a stack primeiro e adaptei cada uma das cinco categorias ao seu equivalente nela. "
        "Neste projeto, \"banco sem tranca\" é RLS e trigger no PostgreSQL. \"Permissão no navegador\" é cruzar os gates de papel "
        "do React com a RLS e as edge functions. IDOR é a checagem de posse em cada handler Deno e em cada RPC. \"Chaves "
        "expostas\" cobre árvore, histórico e bundle. XSS cobre os sinks do React, os renderizadores de markdown e o HTML gerado no servidor. "
        "Só entram achados verificados no código ou no banco, com arquivo e linha. O mapeamento completo está na seção 1."))
    itens.append(Spacer(1, 10))
    linha = [[pm(f"<font size=16><b>{len(D.ACHADOS)}</b></font><br/><font color='#6B7280' size=7.5>achados</font>", "cell")]]
    estilos = []
    for i, s in enumerate(D.SEVERIDADES, start=1):
        linha[0].append(pm(f"<font size=16><b>{cont[s]}</b></font><br/><font color='#6B7280' size=7.5>{escape(s)}</font>", "cell"))
        estilos.append(("LINEABOVE", (i, 0), (i, 0), 3, SEV[s]))
    linha[0].append(pm(f"<font size=16><b>{len(D.PONTOS_FORTES)}</b></font><br/><font color='#6B7280' size=7.5>pontos fortes</font>", "cell"))
    estilos.append(("LINEABOVE", (6, 0), (6, 0), 3, SEV["ponto forte"]))
    t = Table(linha, colWidths=[LARGURA / 7] * 7)
    t.setStyle(TableStyle([("LINEABOVE", (0, 0), (0, 0), 3, INK), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                           ("TOPPADDING", (0, 0), (-1, -1), 6), ("LEFTPADDING", (0, 0), (-1, -1), 4)] + estilos))
    itens.append(t)
    return itens


# ─────────────────────────── seções ───────────────────────────
def secao_metodologia():
    out = titulo_secao("Stack detectada e mapeamento das categorias", 1)
    linhas = [[p("Camada", "cellb"), p("Detectado", "cellb")]] + [[p(a, "cellb"), p(b, "cell")] for a, b in D.STACK]
    t = Table(linhas, colWidths=[3.2 * cm, LARGURA - 3.2 * cm], repeatRows=1)
    t.setStyle(tabela_base())
    out += [t, Spacer(1, 10), pm("Como cada categoria foi mapeada para esta stack", "h2")]
    linhas = [[p("Categoria", "cellb"), p("Equivalente nesta stack e o que foi verificado", "cellb")]]
    for n, nome, texto in D.METODOLOGIA:
        linhas.append([p(f"{n}. {nome}", "cellb"), p(texto, "cell")])
    t = Table(linhas, colWidths=[3.6 * cm, LARGURA - 3.6 * cm], repeatRows=1)
    t.setStyle(tabela_base())
    out += [t, Spacer(1, 6), p(
        "Severidade: crítica = explorável hoje por anônimos com dano amplo; alta = dano financeiro ou de dados "
        "explorável por usuário comum sob condições realistas; média = exposição relevante ou com pré-condição; "
        "baixa = impacto limitado ao próprio usuário ou latente; informativa = higiene, sem exploração direta.", "muted")]
    return out


def tabela_base(cabecalho=True):
    estilos = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]
    if cabecalho:
        estilos += [("BACKGROUND", (0, 0), (-1, 0), SOFT), ("LINEBELOW", (0, 0), (-1, 0), 0.8, colors.HexColor("#D1D5DB"))]
    return TableStyle(estilos)


def secao_resumo():
    cont = contagem_por_severidade()
    out = titulo_secao("Resumo executivo", 2)
    out.append(p(
        f"Foram {len(D.ACHADOS)} achados verificados: {cont['crítica']} crítico, {cont['alta']} alto, {cont['média']} médios, "
        f"{cont['baixa']} baixos e {cont['informativa']} informativos, além de {len(D.PONTOS_FORTES)} pontos fortes com "
        "evidência. A base é sólida: RLS em todas as tabelas, posse conferida em todas as edge functions que recebem IDs, "
        "staff verificado no servidor e nenhum segredo no código atual nem no bundle. Os riscos se concentram em colunas que "
        "o próprio dono consegue alterar (com destaque para o e-mail do perfil, que decide quem recebe um pagamento), no "
        "manuseio do segredo do webhook de pagamento e na listagem aberta de apresentações publicadas."))
    out.append(Spacer(1, 8))
    rosca = imagem(grafico_rosca(), 7.6 * cm)
    linhas = [[p("Severidade", "cellb"), p("Qtde.", "cellb"), p("Achados", "cellb")]]
    for s in D.SEVERIDADES:
        ids = ", ".join(a["id"] for a in D.ACHADOS if a["severidade"] == s) or "—"
        linhas.append([Chip(s, SEV[s], largura=2.15 * cm), p(str(cont[s]), "cellb"), p(ids, "cell")])
    tab = Table(linhas, colWidths=[2.65 * cm, 1.2 * cm, LARGURA - 7.9 * cm - 3.85 * cm])
    tab.setStyle(tabela_base())
    lado = Table([[pm("<b>Achados por severidade</b>", "small"), pm("<b>Distribuição</b>", "small")], [rosca, tab]],
                 colWidths=[7.9 * cm, LARGURA - 7.9 * cm])
    lado.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    out += [lado, Spacer(1, 12), pm("<b>Achados por categoria</b> (empilhado por severidade)", "small"), Spacer(1, 4),
            imagem(grafico_barras(), LARGURA),
            p("A cor da severidade sempre vem com o texto. \"Média\" leva hachura porque é um tom vizinho de \"alta\".", "muted")]
    return out


def secao_fortes_fracos():
    out = titulo_secao("Pontos fortes e pontos fracos", 3)
    out.append(pm("Pontos fortes (o que está protegido, com evidência)", "h2"))
    linhas = [[p("", "cellb"), p("Cat.", "cellb"), p("O que está protegido", "cellb"), p("Evidência", "cellb")]]
    for cat, titulo, evid in D.PONTOS_FORTES:
        linhas.append([Chip("ok", SEV["ponto forte"], largura=0.95 * cm), p(str(cat), "cell"), p(titulo, "cellb"), p(evid, "cell")])
    t = Table(linhas, colWidths=[1.25 * cm, 0.9 * cm, 4.6 * cm, LARGURA - 6.75 * cm], repeatRows=1)
    t.setStyle(tabela_base())
    out += [t, Spacer(1, 10), pm("Pontos fracos (riscos centrais)", "h2")]
    for f in D.PONTOS_FRACOS:
        out.append(Paragraph(escape(f), S["bullet"], bulletText="•"))
    return out


def locais(a, limite=3):
    ls = [loc for loc, _ in a["evidencias"] if not loc.startswith("Impressão")]
    return ls[:limite]


def secao_achados():
    out = titulo_secao("Achados detalhados por categoria", 4)
    out.append(p("Para cada categoria: a tabela-resumo (Severidade | Arquivo:linha | Descrição) e, em seguida, o detalhe "
                 "de cada achado (trecho de código, por que é explorável, condições, impacto e correção). Quando a "
                 "categoria tem poucos achados, a cobertura verificada aparece em \"Pontos fortes\"."))
    for n, nome in D.CATEGORIAS.items():
        achados = [a for a in D.ACHADOS if a["categoria"] == n]
        bloco = [CondPageBreak(6 * cm), pm(f"4.{n} · {escape(nome)}", "h2")]
        if not achados:
            bloco.append(p("Nenhum achado nesta categoria.", "muted"))
            out += bloco
            continue
        linhas = [[p("Severidade", "cellb"), p("Arquivo:linha", "cellb"), p("Descrição", "cellb")]]
        for a in achados:
            loc = "<br/>".join(escape(l) for l in locais(a))
            linhas.append([
                Chip(a["severidade"], SEV[a["severidade"]], largura=2.15 * cm),
                pm(loc, "path"),
                pm(f"<b>{a['id']} · {escape(a['titulo'])}</b><br/>{escape(a['resumo'])}", "cell"),
            ])
        t = Table(linhas, colWidths=[2.5 * cm, 5.9 * cm, LARGURA - 8.4 * cm], repeatRows=1)
        t.setStyle(tabela_base())
        bloco.append(t)
        out += bloco
        for a in achados:
            out += cartao_achado(a)
    return out


def cartao_achado(a):
    cab = Table([[Chip(a["severidade"], SEV[a["severidade"]], largura=2.15 * cm),
                  pm(f"<b>{a['id']} · {escape(a['titulo'])}</b>", "h3")]],
                colWidths=[2.45 * cm, LARGURA - 2.45 * cm])
    cab.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                             ("TOPPADDING", (0, 0), (-1, -1), 0)]))
    evid = [[pm(escape(loc), "path"), Spacer(1, 1.5), caixa_codigo(trecho), Spacer(1, 4)] for loc, trecho in a["evidencias"]]
    topo = [Spacer(1, 10), Regua(LINE, 0.6), Spacer(1, 4), cab, Spacer(1, 3),
            pm(f"<font color='#6B7280'>Categoria {a['categoria']} · {escape(D.CATEGORIAS[a['categoria']])}"
               f"{' · issue ' + str(a['issue']) if a.get('issue') else ''}</font>", "small"), Spacer(1, 4),
            p("EVIDÊNCIA", "label")] + evid[0]
    itens = [KeepTogether(topo)] + [KeepTogether(e) for e in evid[1:]]
    for rotulo, chave in (("POR QUE É EXPLORÁVEL", "exploravel"), ("CONDIÇÕES DE EXPLORAÇÃO", "condicoes"),
                          ("IMPACTO", "impacto"), ("CORREÇÃO SUGERIDA", "correcao")):
        itens += [KeepTogether([p(rotulo, "label"), p(a[chave]), Spacer(1, 3)])]
    return itens


def secao_recomendacoes():
    out = titulo_secao("Recomendações priorizadas", 5)
    cores = {"P1": SEV["crítica"], "P2": SEV["alta"], "P3": SEV["baixa"], "P4": MUTED}
    for pr, prazo, itens in D.RECOMENDACOES:
        corpo = [pm(f"<b>{pr} · {escape(prazo)}</b>", "h3")]
        for i in itens:
            corpo.append(Paragraph(escape(i), S["bullet"], bulletText="•"))
        t = Table([["", corpo]], colWidths=[0.18 * cm, LARGURA - 0.18 * cm])
        t.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, 0), cores[pr]), ("BACKGROUND", (1, 0), (1, 0), SOFT),
                               ("LEFTPADDING", (1, 0), (1, 0), 10), ("TOPPADDING", (0, 0), (-1, -1), 6),
                               ("BOTTOMPADDING", (0, 0), (-1, -1), 8), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
        out += [KeepTogether([t]), Spacer(1, 8)]
    return out


# ─────────────────────────── issues ───────────────────────────
def markdown_issue(issue):
    achados = [a for a in D.ACHADOS if a["id"] in issue["achados"]]
    linhas = [
        f"Título: {issue['titulo']}",
        f"Labels: security, severidade:{issue['severidade']}",
        "",
        "## Descrição do problema",
        "",
        issue["descricao"],
        "",
        "## Por que é explorável",
        "",
    ]
    for a in achados:
        prefixo = f"**{a['id']}** — " if len(achados) > 1 else ""
        cond = "" if a["condicoes"].strip() in ("", "—") else f" Condições: {a['condicoes']}"
        linhas.append(f"{prefixo}{a['exploravel']}{cond}")
        linhas.append("")
    linhas += ["## Evidência", ""] + [f"- {e}" for e in issue["evidencia"]] + [""]
    linhas += ["## Impacto", "", issue["impacto"], ""]
    linhas += ["## Sugestão de correção", ""] + [f"- {c}" for c in issue["correcao"]] + [""]
    linhas += ["## Critérios de aceite", ""] + [f"- [ ] {c}" for c in issue["criterios"]]
    linhas += ["", f"_Achados do relatório de auditoria de {D.DATA}: {', '.join(issue['achados'])}._"]
    return "\n".join(linhas)


def quebrar(md, colunas=104):
    saida = []
    for linha in md.split("\n"):
        if len(linha) <= colunas:
            saida.append(linha)
            continue
        recuo = ""
        if linha.startswith("- [ ] "):
            recuo = "      "
        elif linha.startswith("- ") or linha[:3].rstrip(".").isdigit():
            recuo = "  "
        saida.extend(textwrap.wrap(linha, colunas, subsequent_indent=recuo, break_long_words=True,
                                   break_on_hyphens=False))
    return "\n".join(saida)


def secao_issues():
    out = [PageBreak()] + titulo_secao("ISSUES PARA O GITHUB", 6)
    out.append(p("Texto completo de cada issue, pronto para copiar e colar. Cada bloco vai de --- ISSUE n --- a "
                 "--- FIM ISSUE n ---: a linha \"Título:\" vai no campo de título e o resto no corpo. Achados "
                 "relacionados foram agrupados para evitar issues repetidas. O mesmo conteúdo está em issues-github.md, sem "
                 "quebras de linha, para colar com mais facilidade."))
    out.append(Spacer(1, 6))
    sev_issue = {i["n"]: i["severidade"] for i in D.ISSUES}
    resumo = [[p("Nº", "cellb"), p("Severidade", "cellb"), p("Título", "cellb"), p("Achados", "cellb")]]
    for i in D.ISSUES:
        resumo.append([p(str(i["n"]), "cellb"), Chip(sev_issue[i["n"]], SEV[sev_issue[i["n"]]], largura=2.15 * cm),
                       p(i["titulo"], "cell"), p(", ".join(i["achados"]), "cell")])
    t = Table(resumo, colWidths=[0.9 * cm, 2.55 * cm, LARGURA - 5.45 * cm, 2.0 * cm], repeatRows=1)
    t.setStyle(tabela_base())
    out += [t, Spacer(1, 10)]
    for i in D.ISSUES:
        texto = f"--- ISSUE {i['n']} ---\n" + quebrar(markdown_issue(i)) + f"\n--- FIM ISSUE {i['n']} ---"
        # Uma linha da tabela por bloco (separado por linha em branco): a caixa pode continuar na página seguinte.
        blocos = texto.split("\n\n")
        linhas = [[Preformatted(b, S["issue"])] for b in blocos]
        caixa = Table(linhas, colWidths=[LARGURA], splitByRow=1)
        caixa.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), CODE_BG), ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                                   ("LINEBEFORE", (0, 0), (0, -1), 3, SEV[i["severidade"]]),
                                   ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                                   ("TOPPADDING", (0, 0), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 6.5),
                                   ("TOPPADDING", (0, 0), (-1, 0), 7), ("BOTTOMPADDING", (0, -1), (-1, -1), 7)]))
        out += [CondPageBreak(4 * cm), caixa, Spacer(1, 12)]
    return out


def gerar_markdown():
    partes = [f"# Issues para o GitHub — auditoria de segurança {D.PROJETO} ({D.DATA})", ""]
    for i in D.ISSUES:
        partes += [f"--- ISSUE {i['n']} ---", markdown_issue(i), f"--- FIM ISSUE {i['n']} ---", ""]
    with open(SAIDA_MD, "w", encoding="utf-8") as fh:
        fh.write("\n".join(partes))


# ─────────────────────────── montagem ───────────────────────────
def main():
    doc = BaseDocTemplate(SAIDA_PDF, pagesize=A4, leftMargin=MARGEM, rightMargin=MARGEM, topMargin=MARGEM,
                          bottomMargin=MARGEM, title=TITULO_RELATORIO, author="Auditoria Claude Code",
                          subject="Auditoria de segurança: RLS, permissões, IDOR, segredos e XSS", lang="pt-BR")
    frame = Frame(MARGEM, MARGEM, LARGURA, PAGE_H - 2 * MARGEM, id="f", leftPadding=0, rightPadding=0,
                  topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate(id="capa", frames=[frame], onPage=desenha_capa),
                          PageTemplate(id="normal", frames=[frame])])
    historia = capa_flowables() + [NextPageTemplate("normal"), PageBreak()]
    historia += secao_metodologia() + [PageBreak()]
    historia += secao_resumo() + [PageBreak()]
    historia += secao_fortes_fracos() + [Spacer(1, 14)]
    historia += secao_achados() + [PageBreak()]
    historia += secao_recomendacoes()
    historia += secao_issues()
    doc.build(historia, canvasmaker=CanvasNumerado)
    gerar_markdown()
    print("PDF:", SAIDA_PDF)
    print("Markdown:", SAIDA_MD)


if __name__ == "__main__":
    main()
