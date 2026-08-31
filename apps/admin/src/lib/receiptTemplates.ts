// ─── Receipt Paper Templates ─────────────────────────────────────────────────
//
// Default paper: 80mm wide x 80mm tall, matching the drink-order invoice the
// printer is set up for. The printed page carries its own size tuner, so the
// paper can be changed (or switched to continuous "auto" height) without a
// redeploy; the choice is remembered in localStorage.

export const RECEIPT_PAPER = { width: 80, height: 0 } as const; // mm (height 0 = auto / continuous)

const STORAGE_KEY = 'sd_receipt_size_v2';

export interface ReceiptData {
  order: any;
  logoSrc: string;
  cafeName: string;
  cafeTagline: string;
  addrLine1: string;
  addrLine2: string;
  phone: string;
  wifiName: string;
  wifiPass: string;
  footer: string;
  paymentLabel: string;
  khrRate: number;
}

function esc(s: any): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string
  ));
}

function money(v: any): string {
  return parseFloat(v ?? 0).toFixed(2);
}

/** One receipt copy (merchant or customer). Sizing comes from CSS classes. */
function copyHtml(d: ReceiptData, label: string): string {
  const { order: o, logoSrc, cafeName, cafeTagline, addrLine1, addrLine2,
          phone, wifiName, wifiPass, footer, paymentLabel, khrRate } = d;

  const items = (o.items ?? []).map((i: any) => {
    const variantName = i.variant?.size?.name ?? null;
    const addonNames = i.addons?.length
      ? i.addons.map((a: any) => a.addon?.name).filter(Boolean).join(', ')
      : null;
    return `<div class="row-item">
      <span class="item-name">${esc(i.quantity)}x&nbsp; ${esc(i.product?.name ?? i.item_name ?? 'Item')}${
        variantName ? ' (' + esc(variantName) + ')' : ''
      }${addonNames ? '<br/><span class="tag">+ ' + esc(addonNames) + '</span>' : ''}${
        i.customisation ? '<br/><span class="tag ital">' + esc(i.customisation) + '</span>' : ''
      }</span>
      <span class="amount">$${money(i.subtotal)}</span>
    </div>`;
  }).join('');

  const created = new Date(o.created_at);

  return `<div class="copy">
  <div class="center hdr">
    ${logoSrc ? `<img class="logo" src="${logoSrc}" alt="${esc(cafeName)}" />` : ''}
    <div class="hdr-name">${esc(cafeName)}</div>
    ${cafeTagline ? `<div class="tag">${esc(cafeTagline)}</div>` : ''}
    ${addrLine1 ? `<div class="tag">${esc(addrLine1)}</div>` : ''}
    ${addrLine2 ? `<div class="tag">${esc(addrLine2)}</div>` : ''}
    ${phone ? `<div class="tag">Tel: ${esc(phone)}</div>` : ''}
  </div>
  <div class="line"></div>
  <div class="row"><span>${created.toLocaleDateString()}</span><span>${created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
  <div class="row"><span>Order</span><span class="bold">${esc(o.order_number)}</span></div>
  <div class="row"><span>Type</span><span>${o.order_type === 'dine_in' ? 'DINE IN' : 'TAKE AWAY'}</span></div>
  <div class="line"></div>
  <div class="row col-head"><span>QTY&nbsp; ITEM</span><span>PRICE</span></div>
  ${items}
  <div class="line"></div>
  <div class="row"><span>Subtotal</span><span>$${money(o.subtotal)}</span></div>
  ${parseFloat(o.discount_amount ?? 0) > 0 ? `<div class="row"><span>Discount</span><span>-$${money(o.discount_amount)}</span></div>` : ''}
  <div class="line"></div>
  <div class="total-row"><span>TOTAL</span><span>$${money(o.total_amount)}</span></div>
  <div class="row khr"><span></span><span>${Math.round(parseFloat(o.total_amount ?? 0) * khrRate).toLocaleString()} &#6107;</span></div>
  <div class="line"></div>
  <div class="row"><span>Payment</span><span>${esc(paymentLabel)}</span></div>
  ${o.received_amount ? `<div class="row"><span>Received</span><span>$${money(o.received_amount)}</span></div><div class="row bold"><span>Change</span><span>$${money(o.change_amount)}</span></div>` : ''}
  <div class="line"></div>
  <div class="center foot">*** ${esc(footer)} ***<div class="tag">Please come again</div></div>
  ${(wifiName || wifiPass) ? `<div class="line"></div><div class="center tag"><div class="bold">FREE WIFI</div>${wifiName ? `<div>Network : ${esc(wifiName)}</div>` : ''}${wifiPass ? `<div>Password : ${esc(wifiPass)}</div>` : ''}</div>` : ''}
  <div class="line"></div>
  <div class="center tag bold">${esc(label)}</div>
</div>`;
}

/**
 * Full printable receipt page: merchant copy + customer copy, one page each,
 * plus an on-screen paper-size tuner (hidden when printing).
 */
export function buildReceiptHtmls(d: ReceiptData): string {
  const o = d.order;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Receipt ${esc(o.order_number)}</title>
<style id="sd-size"></style>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New', Courier, monospace; color:#000; background:#fff; }
  .copy { margin:0 auto; page-break-after:always; break-after:page; }
  .copy:last-of-type { page-break-after:auto; break-after:auto; }
  .center { text-align:center; }
  .bold { font-weight:bold; }
  .ital { font-style:italic; }
  .line { border-top:1px dashed #000; }
  .row { display:flex; justify-content:space-between; }
  .row-item { display:flex; justify-content:space-between; }
  .amount { white-space:nowrap; flex-shrink:0; }
  .item-name { flex:1; word-break:break-word; }
  .total-row { display:flex; justify-content:space-between; font-weight:bold; }
  .col-head { font-weight:bold; border-bottom:1px solid #000; }
  .khr { color:#555; }
  .logo { object-fit:contain; margin:0 auto 3px; display:block; }

  /* ── On-screen tuner (never printed) ── */
  #sd-bar { position:fixed; top:0; left:0; right:0; z-index:9999; background:#141414;
            color:#fff; font-family:Arial,sans-serif; font-size:13px; padding:10px 12px;
            display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:center;
            box-shadow:0 2px 8px rgba(0,0,0,.4); }
  #sd-bar b { font-size:12px; letter-spacing:.5px; text-transform:uppercase; opacity:.75; }
  #sd-bar button { font-size:13px; padding:7px 12px; border:0; border-radius:6px;
                   background:#333; color:#fff; cursor:pointer; }
  #sd-bar button:hover { background:#454545; }
  #sd-bar button.on { background:#2563eb; }
  #sd-bar button.go { background:#22c55e; font-weight:bold; padding:8px 22px; }
  #sd-bar input { width:58px; font-size:13px; padding:6px; border:0; border-radius:5px; text-align:center; }
  #sd-hint { color:#fbbf24; font-size:12px; width:100%; text-align:center; }
  #sd-pad { height:104px; }
  .copy { outline:1px dashed #bbb; }

  @media print {
    #sd-bar, #sd-pad { display:none !important; }
    .copy { outline:none; }
  }
</style></head><body>

<div id="sd-bar">
  <b>Receipt paper</b>
  <button data-w="80" data-h="80">80×80</button>
  <button data-w="80" data-h="0">80mm auto</button>
  <button data-w="58" data-h="0">58mm auto</button>
  <button data-w="80" data-h="120">80×120</button>
  <span style="opacity:.5">|</span>
  <input id="sd-w" type="number" min="30" max="220" step="1" title="width mm"> ×
  <input id="sd-h" type="number" min="0" max="400" step="1" title="height mm (0 = auto)"> mm
  <span style="opacity:.6;font-size:11px">(height 0 = auto)</span>
  <span style="opacity:.5">|</span>
  <button class="go" id="sd-print">&#128424; Print</button>
  <button id="sd-close">Close</button>
  <div id="sd-hint"></div>
</div>
<div id="sd-pad"></div>

${copyHtml(d, 'MERCHANT COPY')}
${copyHtml(d, 'CUSTOMER COPY')}

<script>
(function () {
  var KEY = ${JSON.stringify(STORAGE_KEY)};
  var styleEl = document.getElementById('sd-size');
  var wIn = document.getElementById('sd-w');
  var hIn = document.getElementById('sd-h');
  var hint = document.getElementById('sd-hint');

  function setStyle(w, h, k) {
    var px = function (n) { return (n * k).toFixed(2) + 'px'; };
    var bodyW = Math.round(w / 25.4 * 96);

    styleEl.textContent =
      '@page { size: ' + w + 'mm ' + (h ? h + 'mm' : 'auto') + '; margin: 0; }' +
      'html, body { width: ' + w + 'mm; }' +
      '.copy { width: ' + bodyW + 'px; font-size: ' + px(11) + '; padding: ' +
        px(8) + ' ' + px(7) + ' ' + px(14) + ' ' + px(7) + '; }' +
      '.hdr { margin-bottom: ' + px(6) + '; }' +
      '.hdr-name { font-size: ' + px(13) + '; font-weight:bold; letter-spacing:1px; }' +
      '.tag { font-size: ' + px(9) + '; }' +
      '.row, .row-item { font-size: ' + px(11) + '; margin: ' + px(2) + ' 0; }' +
      '.total-row { font-size: ' + px(13) + '; margin: ' + px(2) + ' 0; }' +
      '.foot { font-size: ' + px(10) + '; margin-top: ' + px(6) + '; }' +
      '.line { margin: ' + px(5) + ' 0; }' +
      '.col-head { padding-bottom: ' + px(3) + '; margin-bottom: ' + px(4) + '; }' +
      '.amount { margin-left: ' + px(6) + '; }' +
      '.logo { width: ' + px(44) + '; height: ' + px(44) + '; }';
  }

  function apply(w, h, persist) {
    w = Math.max(30, Math.min(220, +w || ${RECEIPT_PAPER.width}));
    h = Math.max(0, Math.min(400, +h || 0));
    // Font scale relative to a 58mm baseline, damped so 80mm paper is not huge.
    var k = Math.pow(w / 58, 0.6);
    setStyle(w, h, k);

    // Fixed-height paper: shrink the receipt until one copy fits one page,
    // so an invoice never splits across two sheets.
    if (h) {
      var limit = h / 25.4 * 96;
      for (var guard = 0; guard < 24; guard++) {
        var tallest = 0;
        Array.prototype.forEach.call(document.querySelectorAll('.copy'), function (c) {
          tallest = Math.max(tallest, c.offsetHeight);
        });
        if (!tallest || tallest <= limit || k <= 0.4) break;
        k = Math.max(0.4, k * Math.min(0.97, limit / tallest));
        setStyle(w, h, k);
      }
    }

    wIn.value = w; hIn.value = h;
    Array.prototype.forEach.call(document.querySelectorAll('#sd-bar button[data-w]'), function (b) {
      b.className = (+b.dataset.w === w && +b.dataset.h === h) ? 'on' : '';
    });
    if (persist) { try { localStorage.setItem(KEY, JSON.stringify({ w: w, h: h })); } catch (e) {} }
    hint.textContent = 'Printing at ' + w + 'mm × ' + (h ? h + 'mm' : 'auto') +
      '. In the print dialog set Paper size to match, Margins: None, Scale: 100%.';
  }

  Array.prototype.forEach.call(document.querySelectorAll('#sd-bar button[data-w]'), function (b) {
    b.onclick = function () { apply(b.dataset.w, b.dataset.h, true); };
  });
  wIn.oninput = function () { apply(wIn.value, hIn.value, true); };
  hIn.oninput = function () { apply(wIn.value, hIn.value, true); };
  document.getElementById('sd-print').onclick = function () { window.print(); };
  document.getElementById('sd-close').onclick = function () { window.close(); };

  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  apply(saved && saved.w ? saved.w : ${RECEIPT_PAPER.width},
        saved && typeof saved.h === 'number' ? saved.h : ${RECEIPT_PAPER.height}, false);

  var go = function () { setTimeout(function () { window.focus(); window.print(); }, 400); };
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
<\/script>
</body></html>`;
}
