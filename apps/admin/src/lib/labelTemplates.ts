// ─── Drink Cup Label Template ─────────────────────────────────────────────────
//
// Prints one small sticker per cup on an Xprinter (or any) label printer that
// is installed as a normal OS printer (USB driver). Same mechanism as the
// receipt template: build HTML, drop it in a hidden iframe, window.print().
//
// ── Tune the physical sticker size here ──────────────────────────────────────
// Set this to the exact size of the label roll loaded in the Xprinter.
// Common cup-label sizes: 40x30mm, 50x30mm, 40x60mm. If text is cut off or the
// printer feeds a blank label between prints, this is the first thing to adjust.
export const LABEL_SIZE = { width: '40mm', height: '30mm' } as const;

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

  const time = new Date(order.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const typeTag = order.order_type === 'dine_in' ? 'DINE IN' : 'TAKE AWAY';

  return `<div class="label">
    <div class="top">
      <span class="ord">${esc(order.order_number)}</span>
      <span class="cup">${index + 1}/${total}</span>
    </div>
    <div class="name">${esc(name)}${size ? `<span class="size">${esc(size)}</span>` : ''}</div>
    ${lines.length ? `<div class="cust">${lines.map((l) => `<div>${esc(l)}</div>`).join('')}</div>` : ''}
    ${addons.length ? `<div class="addons">+ ${esc(addons.join(', '))}</div>` : ''}
    <div class="bottom"><span>${esc(typeTag)}</span><span>${esc(time)}</span></div>
  </div>`;
}

/**
 * Build a single HTML document containing one printable label per cup.
 * Each `.label` is its own page, so a quantity-3 order prints 3 stickers in
 * one print job.
 */
export function buildDrinkLabelsHtml(order: LabelOrder): string {
  const cups = toCups(order);
  const total = cups.length;
  const labels = cups.map((cup, i) => labelBody(order, cup, i, total)).join('');

  return `<!DOCTYPE html>
<html><head><title>Labels ${esc(order.order_number)}</title>
<style>
  @page { size: ${LABEL_SIZE.width} ${LABEL_SIZE.height}; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${LABEL_SIZE.width}; }
  body { font-family: 'Arial Narrow', Arial, sans-serif; color: #000; background: #fff; }
  .label {
    width: ${LABEL_SIZE.width}; height: ${LABEL_SIZE.height};
    padding: 1.5mm 2mm; overflow: hidden;
    page-break-after: always; break-after: page;
    display: flex; flex-direction: column;
  }
  .label:last-child { page-break-after: auto; break-after: auto; }
  .top { display: flex; justify-content: space-between; align-items: baseline;
         font-size: 8pt; font-weight: 700; }
  .top .ord { letter-spacing: 0.3px; }
  .top .cup { font-size: 7pt; }
  .name { font-size: 13pt; font-weight: 800; line-height: 1.05; margin-top: 0.5mm;
          word-break: break-word; }
  .name .size { display: inline-block; margin-left: 1.5mm; font-size: 10pt;
                border: 1.2pt solid #000; border-radius: 2pt; padding: 0 1mm;
                vertical-align: middle; }
  .cust { margin-top: 0.8mm; font-size: 9pt; font-weight: 700; line-height: 1.15; }
  .addons { margin-top: 0.5mm; font-size: 8pt; font-style: italic; line-height: 1.1; }
  .bottom { margin-top: auto; display: flex; justify-content: space-between;
            font-size: 7pt; font-weight: 700; padding-top: 0.5mm; }
</style></head><body>${labels}</body></html>`;
}
