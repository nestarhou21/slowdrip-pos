// ─── Receipt Paper Size Templates ────────────────────────────────────────────
//
// Switch paper size by changing RECEIPT_PAPER below.
// '58mm' — current thermal paper in use
// '80mm' — standard thermal paper
//
export const RECEIPT_PAPER: '58mm' | '80mm' = '58mm';

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

function receiptBody(d: ReceiptData, size: '58mm' | '80mm'): [string, string] {
  const s = size === '58mm' ? {
    page: '58mm',
    bodyWidth: '210px',
    baseFontSize: '11px',
    logoSize: '44px',
    headerFontSize: '13px',
    taglineFontSize: '9px',
    rowFontSize: '11px',
    totalFontSize: '13px',
    footerFontSize: '10px',
    smallFontSize: '9px',
    copyPadding: '8px 4px 16px 4px',
    lineMrgn: '5px 0',
    rowMrgn: '2px 0',
    itemMrgn: '3px 0',
    headerPb: '3px',
    headerMb: '4px',
    headerMb2: '6px',
    footerMt: '6px',
    footerMt2: '3px',
    wifiMb: '2px',
    amtMl: '6px',
  } : {
    page: '80mm',
    bodyWidth: '302px',
    baseFontSize: '13px',
    logoSize: '60px',
    headerFontSize: '16px',
    taglineFontSize: '11px',
    rowFontSize: '13px',
    totalFontSize: '15px',
    footerFontSize: '13px',
    smallFontSize: '11px',
    copyPadding: '12px 8px 24px 8px',
    lineMrgn: '8px 0',
    rowMrgn: '3px 0',
    itemMrgn: '4px 0',
    headerPb: '4px',
    headerMb: '6px',
    headerMb2: '8px',
    footerMt: '10px',
    footerMt2: '4px',
    wifiMb: '3px',
    amtMl: '8px',
  };

  const { order: o, logoSrc, cafeName, cafeTagline, addrLine1, addrLine2,
          phone, wifiName, wifiPass, footer, paymentLabel, khrRate } = d;

  const singleCopy = (label: string) => `<!DOCTYPE html>
<html><head><title>Receipt ${o.order_number}</title>
<style>
  @page { margin: 0; size: ${s.page} auto; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Courier New', Courier, monospace; font-size: ${s.baseFontSize}; width: ${s.bodyWidth}; margin: 0 auto; padding: ${s.copyPadding}; color: #000; background: #fff; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .line { border-top: 1px dashed #000; margin: ${s.lineMrgn}; }
  .row { display: flex; justify-content: space-between; margin: ${s.rowMrgn}; font-size: ${s.rowFontSize}; }
  .row-item { display: flex; justify-content: space-between; margin: ${s.itemMrgn}; }
  .amount { white-space: nowrap; margin-left: ${s.amtMl}; flex-shrink: 0; }
  .item-name { flex: 1; word-break: break-word; }
  .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: ${s.totalFontSize}; margin: ${s.rowMrgn}; }
</style></head><body>
  <div class="center" style="margin-bottom:${s.headerMb2};">
    ${logoSrc ? `<img src="${logoSrc}" alt="${cafeName}" style="width:${s.logoSize};height:${s.logoSize};object-fit:contain;margin:0 auto 3px;display:block;" />` : ''}
    <div style="font-size:${s.headerFontSize};font-weight:bold;letter-spacing:1px;">${cafeName}</div>
    ${cafeTagline ? `<div style="font-size:${s.taglineFontSize};margin-top:2px;">${cafeTagline}</div>` : ''}
    ${addrLine1 ? `<div style="font-size:${s.taglineFontSize};margin-top:2px;">${addrLine1}</div>` : ''}
    ${addrLine2 ? `<div style="font-size:${s.taglineFontSize};">${addrLine2}</div>` : ''}
    ${phone ? `<div style="font-size:${s.taglineFontSize};margin-top:1px;">Tel: ${phone}</div>` : ''}
  </div>
  <div class="line"></div>
  <div class="row"><span>${new Date(o.created_at).toLocaleDateString()}</span><span>${new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
  <div class="row"><span>Order</span><span class="bold">${o.order_number}</span></div>
  <div class="row"><span>Type</span><span>${o.order_type === 'dine_in' ? 'DINE IN' : 'TAKE AWAY'}</span></div>
  <div class="line"></div>
  <div class="row" style="font-weight:bold;border-bottom:1px solid #000;padding-bottom:${s.headerPb};margin-bottom:${s.headerMb};"><span>QTY  ITEM</span><span>PRICE</span></div>
  ${o.items.map((i: any) => {
    const variantName = i.variant?.size?.name ?? null;
    const addonNames = i.addons?.length > 0 ? i.addons.map((a: any) => a.addon?.name).filter(Boolean).join(', ') : null;
    return `<div class="row-item"><span class="item-name">${i.quantity}x  ${i.product?.name ?? i.item_name ?? 'Item'}${variantName ? ' (' + variantName + ')' : ''}${addonNames ? '<br/><span style="font-size:' + s.taglineFontSize + ';">+ ' + addonNames + '</span>' : ''}${i.customisation ? '<br/><span style="font-size:' + s.taglineFontSize + ';font-style:italic">' + i.customisation + '</span>' : ''}</span><span class="amount">$${parseFloat(i.subtotal).toFixed(2)}</span></div>`;
  }).join('')}
  <div class="line"></div>
  <div class="row"><span>Subtotal</span><span>$${parseFloat(o.subtotal).toFixed(2)}</span></div>
  ${parseFloat(o.discount_amount) > 0 ? `<div class="row"><span>Discount</span><span>-$${parseFloat(o.discount_amount).toFixed(2)}</span></div>` : ''}
  <div class="line"></div>
  <div class="total-row"><span>TOTAL</span><span>$${parseFloat(o.total_amount).toFixed(2)}</span></div>
  <div class="row" style="font-size:${s.taglineFontSize};color:#555;"><span></span><span>${Math.round(parseFloat(o.total_amount) * khrRate).toLocaleString()} ៛</span></div>
  <div class="line"></div>
  <div class="row"><span>Payment</span><span>${paymentLabel}</span></div>
  ${o.received_amount ? `<div class="row"><span>Received</span><span>$${parseFloat(o.received_amount).toFixed(2)}</span></div><div class="row bold"><span>Change</span><span>$${parseFloat(o.change_amount ?? '0').toFixed(2)}</span></div>` : ''}
  <div class="line"></div>
  <div class="center" style="margin-top:${s.footerMt};"><div style="font-size:${s.footerFontSize};">*** ${footer} ***</div><div style="font-size:${s.taglineFontSize};margin-top:${s.footerMt2};">Please come again</div></div>
  ${(wifiName || wifiPass) ? `<div class="line"></div><div class="center" style="font-size:${s.taglineFontSize};"><div style="font-weight:bold;margin-bottom:${s.wifiMb};">FREE WIFI</div>${wifiName ? `<div>Network : ${wifiName}</div>` : ''}${wifiPass ? `<div>Password : ${wifiPass}</div>` : ''}</div>` : ''}
  <div class="line"></div>
  <div class="center" style="font-size:${s.taglineFontSize};font-weight:bold;">${label}</div>
</body></html>`;

  return [singleCopy('MERCHANT COPY'), singleCopy('CUSTOMER COPY')] as [string, string];
}

// Returns [merchantCopyHtml, customerCopyHtml] — print each in its own iframe
export function buildReceiptHtmls(d: ReceiptData): [string, string] {
  return receiptBody(d, RECEIPT_PAPER) as [string, string];
}
