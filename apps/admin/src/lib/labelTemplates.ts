// ─── Drink Cup Label Template ─────────────────────────────────────────────────
//
// Prints one small sticker per cup on an Xprinter (or any) label printer that
// is installed as a normal OS printer (USB driver).
//
// Each label is drawn to a canvas at the exact physical size (300 DPI) and
// placed as an image on a page of the same size. Rasterising sidesteps the
// browser's text layout and pagination, so what you see is exactly what the
// printer receives.
//
// The sticker size is fixed at 30x20mm — every label always prints at that
// size. There is no size picker and no remembered size to drift from it.

// Sticker: 30mm across x 20mm feed direction (landscape). Fixed — always.
export const LABEL_SIZE = { width: '30mm', height: '20mm' } as const;

// Order item as returned by the API (loose — matches ApiOrder.items usage
// elsewhere in the app).
interface LabelItem {
  quantity: number;
  item_name?: string | null;
  product?: { name?: string | null } | null;
  variant?: { size?: { name?: string | null } | null } | null;
  addons?: Array<{ addon?: { name?: string | null } | null }> | null;
  customisation?: string | null;
}

interface LabelOrder {
  order_number: string;
  order_type?: string | null;
  created_at: string;
  items: LabelItem[];
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string
  ));
}

// Split the stored customisation string ("Sugar: 50% | Ice: Normal Ice | no straw").
function customLines(c?: string | null): string[] {
  if (!c) return [];
  return c.split('|').map((p) => p.trim()).filter(Boolean);
}

// Pull sugar level, ice level and any freeform special notes out of the
// customisation string.
function parseCust(c?: string | null): { sugar: string; ice: string; special: string } {
  let sugar = '', ice = '';
  const special: string[] = [];
  for (const p of customLines(c)) {
    const s = /^sugar\s*:?\s*(.+)$/i.exec(p);
    const j = /^ice\s*:?\s*(.+)$/i.exec(p);
    if (s) sugar = s[1].trim();
    else if (j) ice = j[1].trim();
    else special.push(p);
  }
  return { sugar, ice, special: special.join(', ') };
}

const ORDER_TYPE: Record<string, string> = { dine_in: 'Dine-in', takeaway: 'Takeaway', delivery: 'Delivery' };
const SIZE_WORD: Record<string, string> = { S: 'Small', M: 'Medium', L: 'Large', XL: 'Extra Large' };

/** One entry per physical cup, so quantity 2 = 2 labels. Full-word fields. */
interface CupData {
  top: string;       // "D014 / Dine-in   1/1"
  name: string;      // drink name
  size: string;      // "Large" / "Hot"
  sugar: string;     // "Sugar 30%"
  ice: string;       // "Normal Ice"
  toppings: string;  // "+ Aloe Vera, Black Jelly"
  special: string;   // special instructions
}

function toCups(order: LabelOrder): CupData[] {
  const flat: LabelItem[] = [];
  for (const item of order.items) {
    const qty = Math.max(1, item.quantity || 1);
    for (let i = 0; i < qty; i++) flat.push(item);
  }
  const total = flat.length;
  const type = ORDER_TYPE[order.order_type ?? ''] ??
    (order.order_type ? order.order_type.charAt(0).toUpperCase() + order.order_type.slice(1) : '');
  return flat.map((item, i) => {
    const name = item.product?.name ?? item.item_name ?? 'Item';
    const rawSize = item.variant?.size?.name ?? '';
    const addons = (item.addons ?? []).map((a) => a.addon?.name).filter(Boolean) as string[];
    const { sugar, ice, special } = parseCust(item.customisation);
    const hotIce = /hot/i.test(ice);
    const sizeWord = rawSize ? (SIZE_WORD[rawSize] ?? rawSize) : (hotIce ? 'Hot' : '');
    // "Normal Ice" -> "Ice Normal"; "No Ice" stays natural; hot drinks omit it.
    const iceShort = ice.replace(/\s*ice\s*$/i, '').trim();
    const iceLine = (!ice || hotIce) ? ''
      : (iceShort && iceShort.toLowerCase() !== 'no' ? 'Ice ' + iceShort : ice);
    return {
      top: order.order_number + (type ? '  /  ' + type : '') + '      ' + (i + 1) + '/' + total,
      name,
      size: sizeWord,
      sugar: sugar ? 'Sugar ' + sugar : '',
      ice: iceLine,
      toppings: addons.length ? '+ ' + addons.join(', ') : '',
      special,
    };
  });
}

/**
 * Build a complete printable page: one canvas-rendered label image per cup,
 * plus an on-screen size tuner (hidden when printing).
 */
export function buildDrinkLabelsHtml(order: LabelOrder): string {
  const cups = toCups(order);
  const defW = parseFloat(LABEL_SIZE.width);
  const defH = parseFloat(LABEL_SIZE.height);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Labels ${esc(order.order_number)}</title>
<style id="sd-size"></style>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial, sans-serif; color:#000; background:#fff; }
  .label { page-break-after:always; break-after:page; overflow:hidden; }
  .label:last-child { page-break-after:auto; break-after:auto; }
  .label img { width:100%; height:100%; display:block; }

  /* ── On-screen tuner (never printed) ── */
  #sd-bar { position:fixed; top:0; left:0; right:0; z-index:9999; background:#141414;
            color:#fff; font-family:Arial,sans-serif; font-size:13px;
            padding:10px 12px; display:flex; flex-wrap:wrap; gap:8px;
            align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,.4); }
  #sd-bar b { font-size:12px; letter-spacing:.5px; text-transform:uppercase; opacity:.75; }
  #sd-bar button { font-size:13px; padding:7px 12px; border:0; border-radius:6px;
                   background:#333; color:#fff; cursor:pointer; }
  #sd-bar button:hover { background:#454545; }
  #sd-bar button.on { background:#2563eb; }
  #sd-bar button.go { background:#22c55e; font-weight:bold; padding:8px 22px; }
  #sd-bar input { width:58px; font-size:13px; padding:6px; border:0; border-radius:5px;
                  text-align:center; }
  #sd-hint { color:#fbbf24; font-size:12px; width:100%; text-align:center; }
  #sd-pad { height:104px; }
  .sheet { display:flex; flex-direction:column; align-items:center; gap:6px; }
  .label { outline:1px dashed #bbb; }

  @media print {
    #sd-bar, #sd-pad { display:none !important; }
    .sheet { display:block; gap:0; }
    .label { outline:none; }
  }
</style></head><body>

<div id="sd-bar">
  <b>Cup labels · 30×20mm</b>
  <button class="go" id="sd-print">🖨 Print</button>
  <button id="sd-close">Close</button>
  <div id="sd-hint"></div>
</div>
<div id="sd-pad"></div>

<div class="sheet" id="sd-sheet"></div>

<script>
(function () {
  var CUPS = ${JSON.stringify(cups)};
  var DPI = 300;
  var LW = ${defW}, LH_MM = ${defH};   // fixed sticker size in mm — always 30x20
  var styleEl = document.getElementById('sd-size');
  var sheet = document.getElementById('sd-sheet');
  var hint = document.getElementById('sd-hint');

  function font(ctx, px, weight, italic) {
    ctx.font = (italic ? 'italic ' : '') + (weight || 'normal') + ' ' + px + 'px Arial, sans-serif';
  }

  // Greedy word wrap at the current ctx.font.
  function wrap(ctx, text, maxW) {
    var words = text.split(/\\s+/).filter(Boolean);
    if (!words.length) return [];
    var lines = [], cur = words[0];
    for (var i = 1; i < words.length; i++) {
      if (ctx.measureText(cur + ' ' + words[i]).width <= maxW) cur += ' ' + words[i];
      else { lines.push(cur); cur = words[i]; }
    }
    lines.push(cur);
    return lines;
  }

  // Largest font size at which the text fits maxW within maxLines.
  function fit(ctx, text, maxW, maxPx, minPx, maxLines, weight, italic) {
    for (var s = maxPx; s >= minPx; s -= 1) {
      font(ctx, s, weight, italic);
      var ls = wrap(ctx, text, maxW);
      var ok = ls.length <= maxLines;
      for (var i = 0; i < ls.length && ok; i++) if (ctx.measureText(ls[i]).width > maxW) ok = false;
      if (ok) return { size: s, lines: ls };
    }
    font(ctx, minPx, weight, italic);
    return { size: minPx, lines: wrap(ctx, text, maxW).slice(0, maxLines) };
  }

  function drawLabel(cup, wmm, hmm) {
    var W = Math.round(wmm / 25.4 * DPI);
    var H = Math.round(hmm / 25.4 * DPI);
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Keep the text well inside the sticker with clear whitespace around it —
    // the text should look small on the 30x20 label, not fill it edge to edge.
    var maxW = W * 0.84;
    var availH = H * 0.72;
    var LH = 1.18;   // line height multiplier — a little breathing room between rows

    // Every field prints at the SAME font size. Fields keep their own weight
    // (name bold, special italic) and max wrap lines, but the size is uniform.
    var fields = [
      { text: cup.top,      maxLines: 1, weight: 'bold',   italic: false },
      { text: cup.name,     maxLines: 2, weight: 'bold',   italic: false },
      { text: cup.size,     maxLines: 1, weight: 'normal', italic: false },
      { text: cup.sugar,    maxLines: 1, weight: 'normal', italic: false },
      { text: cup.ice,      maxLines: 1, weight: 'normal', italic: false },
      { text: cup.toppings, maxLines: 2, weight: 'normal', italic: false },
      { text: cup.special,  maxLines: 2, weight: 'normal', italic: true  }
    ].filter(function (f) { return f.text; });

    // Cap the size deliberately small, then find the largest single size at
    // which every field wraps within the width and the whole stack fits the
    // height. gap between blocks is a fixed fraction of the chosen size.
    var maxPx = Math.round(H * 0.10);   // smaller, uniform cap
    var minPx = 4;
    var blocks, totalH, size;
    for (size = maxPx; size >= minPx; size -= 1) {
      font(ctx, size, 'normal', false);
      var gap = size * 0.28;
      blocks = [];
      totalH = 0;
      var ok = true;
      for (var i = 0; i < fields.length && ok; i++) {
        var f = fields[i];
        font(ctx, size, f.weight, f.italic);
        var lines = wrap(ctx, f.text, maxW);
        if (lines.length > f.maxLines) { ok = false; break; }
        for (var k = 0; k < lines.length; k++) {
          if (ctx.measureText(lines[k]).width > maxW) { ok = false; break; }
        }
        blocks.push({ lines: lines, size: size, weight: f.weight, italic: f.italic, gap: gap });
        totalH += lines.length * size * LH + gap;
      }
      if (ok) { totalH -= gap; if (totalH <= availH) break; }   // drop trailing gap
    }

    // Trim the font's built-in ascent padding so the ink, not the glyph box,
    // is centred on the sticker.
    var first = blocks[0];
    font(ctx, first.size, first.weight, first.italic);
    var m = ctx.measureText(first.lines[0] || 'X');
    var inkTop = (m.actualBoundingBoxAscent != null)
      ? first.size * (LH - 1) / 2 + (first.size - m.actualBoundingBoxAscent) * 0.35
      : 0;

    var y = (H - totalH) / 2 - inkTop;
    blocks.forEach(function (b) {
      font(ctx, b.size, b.weight, b.italic);
      b.lines.forEach(function (ln) {
        ctx.fillText(ln, W / 2, y);
        y += b.size * LH;
      });
      y += b.gap;
    });
    return cv;
  }

  function render(w, h) {
    sheet.innerHTML = '';
    CUPS.forEach(function (cup) {
      var d = document.createElement('div');
      d.className = 'label';
      var img = document.createElement('img');
      img.src = drawLabel(cup, w, h).toDataURL('image/png');
      d.appendChild(img);
      sheet.appendChild(d);
    });
  }

  // Fixed page + label size — always 30x20mm, no adjustment.
  styleEl.textContent =
    '@page { size: ' + LW + 'mm ' + LH_MM + 'mm; margin: 0; }' +
    'html, body { width: ' + LW + 'mm; }' +
    '.label { width: ' + LW + 'mm; height: ' + LH_MM + 'mm; }';
  render(LW, LH_MM);

  document.getElementById('sd-print').onclick = function () { window.print(); };
  document.getElementById('sd-close').onclick = function () { window.close(); };

  hint.textContent = 'In the print dialog set Paper size to 30×20mm, Margins: None, Scale: 100%.';
  setTimeout(function () { window.focus(); window.print(); }, 400);
})();
<\/script>
</body></html>`;
}
