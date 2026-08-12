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
// The printed page carries its own size tuner: the barista picks the sticker
// size once, it is remembered in localStorage, and every later print goes
// straight to the print dialog at that size.

// Default sticker: 30mm across x 20mm feed direction (landscape).
export const LABEL_SIZE = { width: '30mm', height: '20mm' } as const;

const STORAGE_KEY = 'sd_label_size';

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

// Split the stored customisation string ("Sugar: 50% | Ice: Normal | no straw")
// into individual parts for the label.
function customLines(c?: string | null): string[] {
  if (!c) return [];
  return c.split('|').map((p) => p.trim()).filter(Boolean);
}

/** One entry per physical cup, so quantity 2 = 2 labels. */
interface CupData {
  top: string;
  name: string;
  cust: string;
  addons: string;
}

function toCups(order: LabelOrder): CupData[] {
  const flat: LabelItem[] = [];
  for (const item of order.items) {
    const qty = Math.max(1, item.quantity || 1);
    for (let i = 0; i < qty; i++) flat.push(item);
  }
  const total = flat.length;
  return flat.map((item, i) => {
    const name = item.product?.name ?? item.item_name ?? 'Item';
    const size = item.variant?.size?.name ?? '';
    const addons = (item.addons ?? []).map((a) => a.addon?.name).filter(Boolean) as string[];
    return {
      top: order.order_number + '  ·  ' + (i + 1) + '/' + total,
      name: size ? name + ' (' + size + ')' : name,
      cust: customLines(item.customisation).join('  ·  '),
      addons: addons.length ? '+ ' + addons.join(', ') : '',
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
  <b>Sticker size</b>
  <button data-w="30" data-h="20">30×20</button>
  <button data-w="40" data-h="20">40×20</button>
  <button data-w="40" data-h="30">40×30</button>
  <button data-w="50" data-h="25">50×25</button>
  <button data-w="50" data-h="30">50×30</button>
  <button data-w="60" data-h="40">60×40</button>
  <span style="opacity:.5">|</span>
  <input id="sd-w" type="number" min="10" max="200" step="1" title="width mm"> ×
  <input id="sd-h" type="number" min="10" max="200" step="1" title="height mm"> mm
  <button id="sd-swap" title="Swap width and height">⇄ Rotate</button>
  <span style="opacity:.5">|</span>
  <button class="go" id="sd-print">🖨 Print</button>
  <button id="sd-close">Close</button>
  <div id="sd-hint"></div>
</div>
<div id="sd-pad"></div>

<div class="sheet" id="sd-sheet"></div>

<script>
(function () {
  var KEY = ${JSON.stringify(STORAGE_KEY)};
  var CUPS = ${JSON.stringify(cups)};
  var DPI = 300;
  var styleEl = document.getElementById('sd-size');
  var sheet = document.getElementById('sd-sheet');
  var wIn = document.getElementById('sd-w');
  var hIn = document.getElementById('sd-h');
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

    var padY = Math.round(H * 0.05);
    var maxW = W - Math.round(W * 0.06) * 2;
    var availH = H - padY * 2;

    // Lay the label out at a given scale. Text is shrunk horizontally by fit()
    // and the whole stack is shrunk vertically by lowering the scale until the
    // blocks fit the sticker height.
    function build(sc) {
      var bl = [];
      function add(text, frac, minPx, maxLines, weight, italic, gapFrac) {
        if (!text) return;
        var maxPx = Math.max(minPx, Math.round(H * frac * sc));
        var b = fit(ctx, text, maxW, maxPx, minPx, maxLines, weight, italic);
        b.weight = weight; b.italic = italic; b.gap = H * gapFrac * sc;
        bl.push(b);
      }
      add(cup.top,    0.13, 5, 1, 'bold',   false, 0.04);
      add(cup.name,   0.28, 7, 2, 'bold',   false, cup.cust || cup.addons ? 0.03 : 0);
      add(cup.cust,   0.15, 5, 2, 'bold',   false, cup.addons ? 0.02 : 0);
      add(cup.addons, 0.12, 4, 1, 'normal', true,  0);
      return bl;
    }

    var blocks, totalH;
    for (var sc = 1; sc >= 0.3; sc -= 0.05) {
      blocks = build(sc);
      totalH = 0;
      blocks.forEach(function (b) { totalH += b.lines.length * b.size * 1.15 + b.gap; });
      if (totalH <= availH) break;
    }

    var y = Math.max(padY, (H - totalH) / 2);
    blocks.forEach(function (b) {
      font(ctx, b.size, b.weight, b.italic);
      b.lines.forEach(function (ln) {
        ctx.fillText(ln, W / 2, y);
        y += b.size * 1.15;
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

  function apply(w, h, persist) {
    w = Math.max(10, Math.min(200, +w || ${defW}));
    h = Math.max(10, Math.min(200, +h || ${defH}));
    styleEl.textContent =
      '@page { size: ' + w + 'mm ' + h + 'mm; margin: 0; }' +
      'html, body { width: ' + w + 'mm; }' +
      '.label { width: ' + w + 'mm; height: ' + h + 'mm; }';
    wIn.value = w; hIn.value = h;
    Array.prototype.forEach.call(document.querySelectorAll('#sd-bar button[data-w]'), function (b) {
      b.className = (+b.dataset.w === w && +b.dataset.h === h) ? 'on' : '';
    });
    render(w, h);
    if (persist) { try { localStorage.setItem(KEY, JSON.stringify({ w: w, h: h })); } catch (e) {} }
  }

  Array.prototype.forEach.call(document.querySelectorAll('#sd-bar button[data-w]'), function (b) {
    b.onclick = function () { apply(b.dataset.w, b.dataset.h, true); };
  });
  wIn.oninput = function () { apply(wIn.value, hIn.value, true); };
  hIn.oninput = function () { apply(wIn.value, hIn.value, true); };
  document.getElementById('sd-swap').onclick = function () { apply(hIn.value, wIn.value, true); };
  document.getElementById('sd-print').onclick = function () { window.print(); };
  document.getElementById('sd-close').onclick = function () { window.close(); };

  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}

  if (saved && saved.w && saved.h) {
    apply(saved.w, saved.h, false);
    hint.textContent = 'Printing at ' + saved.w + '×' + saved.h + 'mm. In the print dialog set Paper size to match, Margins: None, Scale: 100%.';
    setTimeout(function () { window.focus(); window.print(); }, 500);
  } else {
    apply(${defW}, ${defH}, false);
    hint.textContent = 'First time: pick your sticker size above (measure one sticker), then click Print. Your choice is remembered.';
  }
})();
<\/script>
</body></html>`;
}
