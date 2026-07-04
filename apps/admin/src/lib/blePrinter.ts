import type { ApiOrder } from "@repo/store";

const SERVICE_UUID = "49535343-fe7d-4ae5-8fa9-9fafd205e455";
const WRITE_CHAR_UUID = "49535343-8841-43f4-a8d4-ecbe34729bb3";

const CHUNK_SIZE = 100; // bytes per BLE write (negotiate higher MTU)
const CHUNK_DELAY = 30; // ms between chunks

// ── Paper width ───────────────────────────────────────────────────────────────
// Tune this if content is cut off (reduce) or looks too narrow (increase)
// 48 works for this printer regardless of paper label
const W = 48;

// Cached across prints within the same browser session
let _device: BluetoothDevice | null = null;
let _char: BluetoothRemoteGATTCharacteristic | null = null;

async function getCharacteristic(): Promise<BluetoothRemoteGATTCharacteristic> {
  // Try reconnecting to cached device first (avoids re-showing the picker)
  if (_device) {
    if (!_device.gatt?.connected) {
      try {
        const server = await _device.gatt!.connect();
        const service = await server.getPrimaryService(SERVICE_UUID);
        _char = await service.getCharacteristic(WRITE_CHAR_UUID);
        return _char;
      } catch {
        // Reconnect failed — clear cache and show picker
        _device = null;
        _char = null;
      }
    } else if (_char) {
      return _char;
    }
  }

  const device = await navigator.bluetooth.requestDevice({
    filters: [{ namePrefix: "GL" }],
    optionalServices: [SERVICE_UUID],
  });

  const server = await device.gatt!.connect();
  const service = await server.getPrimaryService(SERVICE_UUID);
  const char = await service.getCharacteristic(WRITE_CHAR_UUID);

  _device = device;
  _char = char;

  device.addEventListener("gattserverdisconnected", () => {
    _device = null;
    _char = null;
  });

  return char;
}

async function writeChunked(
  char: BluetoothRemoteGATTCharacteristic,
  data: Uint8Array
): Promise<void> {
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    await char.writeValueWithoutResponse(data.slice(i, i + CHUNK_SIZE));
    if (i + CHUNK_SIZE < data.length) {
      await new Promise((r) => setTimeout(r, CHUNK_DELAY));
    }
  }
}

// ─── ESC/POS builder ─────────────────────────────────────────────────────────

function buildEscPos(order: ApiOrder, settings?: Record<string, any>, label = "CUSTOMER COPY"): Uint8Array {
  const buf: number[] = [];

  const push = (...b: number[]) => buf.push(...b);
  const text = (s: string) => buf.push(...new TextEncoder().encode(s));
  const lf = () => push(0x0a);
  const line = (ch = "-") => { text(ch.repeat(W)); lf(); };

  const twoCol = (left: string, right: string) => {
    const gap = Math.max(1, W - left.length - right.length);
    text(left + " ".repeat(gap) + right);
    lf();
  };

  const itemRow = (label: string, price: string) => {
    if (label.length + price.length + 1 > W) {
      label = label.slice(0, W - price.length - 1);
    }
    twoCol(label, price);
  };

  // Init + set left margin to centre content on 56mm paper
  push(0x1b, 0x40);
  push(0x1d, 0x4c, 0x08, 0x00); // GS L — left margin ~8 dots

  // ── Header (center) ──
  push(0x1b, 0x61, 0x01);
  push(0x1b, 0x45, 0x01); // bold
  push(0x1b, 0x21, 0x30); // double width+height
  text((settings?.cafe_name ?? "ZENHOUSE").toUpperCase()); lf();
  push(0x1b, 0x21, 0x00); // normal size
  push(0x1b, 0x45, 0x00); // bold off

  if (settings?.address_line1) { text(settings.address_line1); lf(); }
  if (settings?.address_line2) { text(settings.address_line2); lf(); }
  if (settings?.phone) { text("Tel: " + settings.phone); lf(); }
  lf();

  // ── Order info (left) ──
  push(0x1b, 0x61, 0x00);
  line();

  const d = new Date(order.created_at);
  const dateStr = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
    + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  twoCol("Date", dateStr);
  twoCol("Order", order.order_number);
  twoCol("Type", order.order_type === "dine_in" ? "DINE IN" : "TAKE AWAY");
  line();

  // ── Items ──
  for (const item of order.items) {
    let label = `${item.quantity}x ${item.product?.name ?? item.item_name ?? "Item"}`;
    if (item.variant?.size?.name) label += ` (${item.variant.size.name})`;
    itemRow(label, "$" + parseFloat(item.subtotal).toFixed(2));

    for (const a of item.addons ?? []) {
      if ((a as any).addon?.name) { text("  + " + (a as any).addon.name); lf(); }
    }
    if (item.customisation) { text("  " + item.customisation); lf(); }
  }

  // ── Totals ──
  line();
  twoCol("Subtotal", "$" + parseFloat(order.subtotal).toFixed(2));

  if (parseFloat(order.discount_amount) > 0) {
    twoCol("Discount", "-$" + parseFloat(order.discount_amount).toFixed(2));
  }

  line("=");

  push(0x1b, 0x45, 0x01);
  push(0x1b, 0x21, 0x10); // double height
  twoCol("TOTAL", "$" + parseFloat(order.total_amount).toFixed(2));
  push(0x1b, 0x21, 0x00);
  push(0x1b, 0x45, 0x00);

  line();

  const payLabels: Record<string, string> = {
    qr: "ABA QR", bakong: "Bakong KHQR", cash: "CASH", card: "CARD",
  };
  twoCol("Payment", payLabels[order.payment_method] ?? order.payment_method.toUpperCase());

  if (order.received_amount) {
    twoCol("Received", "$" + parseFloat(order.received_amount).toFixed(2));
    twoCol("Change", "$" + parseFloat(order.change_amount ?? "0").toFixed(2));
  }

  line();

  // ── Footer (center) ──
  push(0x1b, 0x61, 0x01);
  text("*** " + (settings?.receipt_footer ?? "Thank you for your visit!") + " ***"); lf();
  text(label); lf();
  lf(); lf(); lf();

  // Paper cut
  push(0x1d, 0x56, 0x41, 0x03);

  return new Uint8Array(buf);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function isBleSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export async function blePrintReceipt(
  order: ApiOrder,
  settings?: Record<string, any>
): Promise<void> {
  if (!isBleSupported()) {
    throw new Error("Web Bluetooth is not supported in this browser.");
  }
  const char = await getCharacteristic();
  await writeChunked(char, buildEscPos(order, settings, "CUSTOMER COPY"));
}

// Prints merchant copy then customer copy in one BLE session
export async function blePrintReceiptDouble(
  order: ApiOrder,
  settings?: Record<string, any>
): Promise<void> {
  if (!isBleSupported()) {
    throw new Error("Web Bluetooth is not supported in this browser.");
  }
  const char = await getCharacteristic();
  await writeChunked(char, buildEscPos(order, settings, "MERCHANT COPY"));
  // Give the printer time to cut and feed before sending the second job
  await new Promise(r => setTimeout(r, 800));
  await writeChunked(char, buildEscPos(order, settings, "CUSTOMER COPY"));
}

/** Disconnect and clear cached device (e.g. on page unload or manual reset) */
export function bleDisconnect(): void {
  _device?.gatt?.disconnect();
  _device = null;
  _char = null;
}
