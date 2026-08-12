// ─── Drink Cup Label Template ─────────────────────────────────────────────────
//
// Prints one small sticker per cup on an Xprinter (or any) label printer that
// is installed as a normal OS printer (USB driver).
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
// into individual lines for the label.
function customLines(c?: string | null): string[] {
  if (!c) return [];
  return c.split('|').map((p) => p.trim()).filter(Boolean);
}

// Flatten an order into one entry per physical cup, so quantity 2 = 2 labels.
interface Cup { item: LabelItem; }
function toCups(order: LabelOrder): Cup[] {
  const cups: Cup[] = [];
  for (const item of order.items) {
    const qty = Math.max(1, item.quantity || 1);
    for (let i = 0; i < qty; i++) cups.push({ item });
  }
  return cups;
}

function labelBody(order: LabelOrder, cup: Cup, index: number, total: number): string {
  const { item } = cup;
  const name = item.product?.name ?? item.item_name ?? 'Item';
  const size = item.variant?.size?.name ?? '';
  const addons = (item.addons ?? [])
    .map((a) => a.addon?.name)
    .filter(Boolean) as string[];
  const lines = customLines(item.customisation);

  return `<div class="label">
    <div class="top">${esc(order.order_number)} &middot; ${index + 1}/${total}</div>
    <div class="name">${esc(name)}${size ? ` <span class="size">${esc(size)}</span>` : ''}</div>
    ${lines.length ? `<div class="cust">${esc(lines.join(' · '))}</div>` : ''}
    ${addons.length ? `<div class="addons">+ ${esc(addons.join(', '))}</div>` : ''}
  </div>`;
}

/**
 * Build a complete printable page containing one label per cup, plus an
 * on-screen size tuner (hidden when printing). Each `.label` is its own page,
 * so a quantity-3 order prints 3 stickers in one job.
 */
export function buildDrinkLabelsHtml(order: LabelOrder): string {
  const cups = toCups(order);
  const total = cups.length;
  const labels = cups.map((cup, i) => labelBody(order, cup, i, total)).join('');
  const defW = parseFloat(LABEL_SIZE.width);
  const defH = parseFloat(LABEL_SIZE.height);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Labels ${esc(order.order_number)}</title>
<style id="sd-size"></style>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Arial Narrow', Arial, sans-serif; color:#000; background:#fff; }
  .label {
    padding: 0.8mm 1mm; overflow:hidden;
    page-break-after: always; break-after: page;
    display:flex; flex-direction:column;
    align-items:center; justify-content:center; text-align:center;
  }
  .label:last-child { page-break-after:auto; break-after:auto; }
  .name { font-weight:800; line-height:1.05; margin-top:0.4mm; word-break:break-word; }
  .top  { font-weight:700; letter-spacing:0.2px; }
  .size { display:inline-block; font-weight:800; border:0.8pt solid #000;
          border-radius:1pt; padding:0 0.8mm; vertical-align:middle; }
  .cust { font-weight:700; line-height:1.15; margin-top:0.4mm; }
  .addons { font-style:italic; line-height:1.05; margin-top:0.3mm; }

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

<div class="sheet">${labels}</div>

<script>
(function () {
  var KEY = ${JSON.stringify(STORAGE_KEY)};
  var styleEl = document.getElementById('sd-size');
  var wIn = document.getElementById('sd-w');
  var hIn = document.getElementById('sd-h');
  var hint = document.getElementById('sd-hint');
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}

  function apply(w, h, persist) {
    w = Math.max(10, Math.min(200, +w || ${defW}));
    h = Math.max(10, Math.min(200, +h || ${defH}));
    var k = Math.max(0.55, Math.min(2.4, h / 20));   // font scale vs the 20mm baseline
    styleEl.textContent =
      '@page { size: ' + w + 'mm ' + h + 'mm; margin: 0; }' +
      'html, body { width: ' + w + 'mm; }' +
      '.label { width: ' + w + 'mm; height: ' + h + 'mm; }' +
      '.top { font-size: ' + (5 * k).toFixed(2) + 'pt; }' +
      '.name { font-size: ' + (8.5 * k).toFixed(2) + 'pt; }' +
      '.size { font-size: ' + (7 * k).toFixed(2) + 'pt; }' +
      '.cust { font-size: ' + (6.5 * k).toFixed(2) + 'pt; }' +
      '.addons { font-size: ' + (5.5 * k).toFixed(2) + 'pt; }';
    wIn.value = w; hIn.value = h;
    Array.prototype.forEach.call(document.querySelectorAll('#sd-bar button[data-w]'), function (b) {
      b.className = (+b.dataset.w === w && +b.dataset.h === h) ? 'on' : '';
    });
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

  if (saved && saved.w && saved.h) {
    apply(saved.w, saved.h, false);
    hint.textContent = 'Printing at ' + saved.w + '×' + saved.h + 'mm. In the print dialog set Paper size to match, Margins: None, Scale: 100%.';
    setTimeout(function () { window.focus(); window.print(); }, 400);
  } else {
    apply(${defW}, ${defH}, false);
    hint.textContent = 'First time: pick your sticker size above (measure one sticker), then click Print. Your choice is remembered.';
  }
})();
<\/script>
</body></html>`;
}
