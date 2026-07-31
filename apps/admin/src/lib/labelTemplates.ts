// ─── Drink Cup Label Template ─────────────────────────────────────────────────
//
// Prints one small sticker per cup on an Xprinter (or any) label printer that
// is installed as a normal OS printer (USB driver). Same mechanism as the
// receipt template: build HTML, drop it in a hidden iframe, window.print().
//
// ── Tune the physical sticker size here ──────────────────────────────────────
// Cup sticker: width is across the paper, height is the feed direction.
// Current roll: 30mm wide x 20mm tall (small landscape). If text is cut off or
// a blank label feeds between prints, adjust these two numbers.
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
  /* Vertical / portrait label: taller than wide. */
  @page { size: ${LABEL_SIZE.width} ${LABEL_SIZE.height}; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${LABEL_SIZE.width}; }
  body { font-family: 'Arial Narrow', Arial, sans-serif; color: #000; background: #fff; }
  .label {
    width: ${LABEL_SIZE.width}; height: ${LABEL_SIZE.height};
    padding: 0.8mm 1mm; overflow: hidden;
    page-break-after: always; break-after: page;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center;
  }
  .label:last-child { page-break-after: auto; break-after: auto; }
  .top { font-size: 5pt; font-weight: 700; letter-spacing: 0.2px; }
  .name { font-size: 8.5pt; font-weight: 800; line-height: 1.05; margin-top: 0.4mm;
          word-break: break-word; }
  .size { display: inline-block; font-size: 7pt; font-weight: 800;
          border: 0.8pt solid #000; border-radius: 1pt; padding: 0 0.8mm;
          vertical-align: middle; }
  .cust { font-size: 6.5pt; font-weight: 700; line-height: 1.15; margin-top: 0.4mm; }
  .addons { font-size: 5.5pt; font-style: italic; line-height: 1.05; margin-top: 0.3mm; }
</style></head><body>${labels}</body></html>`;
}
