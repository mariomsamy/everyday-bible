// Draws a verse card (PNG) for social media with the Canvas API. No third-party code, no network.

export interface CardStyle { id: string; bg: [string, string]; fg: string; accent: string }
export const CARD_STYLES: CardStyle[] = [
  { id: 'night', bg: ['#16213e', '#0f3460'], fg: '#fdf7e8', accent: '#f2c46d' },
  { id: 'dawn', bg: ['#f8e7c9', '#f3b98b'], fg: '#3b2a1a', accent: '#8a4b1f' },
  { id: 'forest', bg: ['#14352a', '#1f5c47'], fg: '#f1f7ee', accent: '#c9e4a5' },
  { id: 'paper', bg: ['#fbf8f1', '#efe7d6'], fg: '#1d2027', accent: '#2c4a8f' },
];

export interface CardInput {
  text: string;
  reference: string;
  version: string;
  footer: string;
  rtl: boolean;
  style: CardStyle;
}

export const CARD_W = 1080;
export const CARD_H = 1350;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxW && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
  }
  return lines;
}

export async function drawCard(canvas: HTMLCanvasElement, c: CardInput): Promise<void> {
  const serif = c.rtl ? '"Noto Naskh Arabic", serif' : '"Literata Variable", Georgia, serif';
  // Make sure the fonts are ready before measuring, or the layout is computed with fallbacks.
  await Promise.all([document.fonts.load(`700 40px ${serif}`), document.fonts.load(`400 40px ${serif}`), document.fonts.load('600 30px "Inter Variable"')]).catch(() => undefined);
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  g.addColorStop(0, c.style.bg[0]);
  g.addColorStop(1, c.style.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const pad = 110;
  const maxW = CARD_W - pad * 2;
  const top = 250;
  const bottom = CARD_H - 330;
  ctx.direction = c.rtl ? 'rtl' : 'ltr';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Largest font size whose wrapped text fits the box.
  let size = 74;
  let lines: string[] = [];
  let lh = 0;
  for (; size >= 30; size -= 2) {
    ctx.font = `${c.rtl ? 700 : 400} ${size}px ${serif}`;
    lines = wrap(ctx, c.text, maxW);
    lh = size * (c.rtl ? 1.85 : 1.5);
    if (lines.length * lh <= bottom - top) break;
  }
  // Very long selections: truncate with an ellipsis instead of overflowing.
  const maxLines = Math.max(1, Math.floor((bottom - top) / lh));
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
  }

  // Decorative quote mark and rule
  ctx.fillStyle = c.style.accent;
  ctx.globalAlpha = 0.9;
  ctx.font = `700 150px ${serif}`;
  ctx.fillText('“', CARD_W / 2, 200);
  ctx.globalAlpha = 1;

  ctx.fillStyle = c.style.fg;
  ctx.font = `${c.rtl ? 700 : 400} ${size}px ${serif}`;
  const blockH = lines.length * lh;
  let y = top + (bottom - top - blockH) / 2 + lh * 0.75;
  for (const line of lines) {
    ctx.fillText(line, CARD_W / 2, y);
    y += lh;
  }

  ctx.fillStyle = c.style.accent;
  ctx.fillRect(CARD_W / 2 - 50, CARD_H - 300, 100, 4);
  ctx.font = `700 52px ${c.rtl ? serif : '"Inter Variable", system-ui, sans-serif'}`;
  ctx.fillText(c.reference, CARD_W / 2, CARD_H - 220);
  ctx.fillStyle = c.style.fg;
  ctx.globalAlpha = 0.75;
  ctx.font = '600 30px "Inter Variable", system-ui, sans-serif';
  ctx.fillText(c.version, CARD_W / 2, CARD_H - 165);
  ctx.globalAlpha = 0.6;
  ctx.font = `400 28px ${c.rtl ? serif : '"Inter Variable", system-ui, sans-serif'}`;
  ctx.fillText(c.footer, CARD_W / 2, CARD_H - 90);
  ctx.globalAlpha = 1;
}

export const canvasBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
