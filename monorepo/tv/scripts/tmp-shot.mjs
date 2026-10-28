/**
 * TEMPORARY screenshot harness for the player bar visual check.
 *   node scripts/tmp-shot.mjs <url> <width> <height> <out.png>
 * Deleted before hand-off; nothing here is committed.
 */
import { spawn } from "node:child_process";
import { rm, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import net from "node:net";
import crypto from "node:crypto";

const URL_TO_SHOT = process.argv[2];
const WIDTH = Number(process.argv[3] ?? 360);
const HEIGHT = Number(process.argv[4] ?? 800);
const OUT_FILE = process.argv[5];
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9339;
const OUT = resolve(tmpdir(), "acum-tmp-shot");
const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

function connectWs(url) {
  const { hostname, port, pathname } = new URL(url);
  const key = crypto.randomBytes(16).toString("base64");
  const socket = net.connect(Number(port), hostname);
  let buffer = Buffer.alloc(0);
  let done = false;
  let leftovers = Buffer.alloc(0);
  const waiters = [];
  const listeners = [];
  socket.on("connect", () => {
    socket.write(
      `GET ${pathname} HTTP/1.1\r\nHost: ${hostname}:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`,
    );
  });
  const emit = (text) => {
    const message = JSON.parse(text);
    const waiter = waiters.shift();
    if (waiter) waiter(message);
    for (const l of listeners) l(message);
  };
  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    if (!done) {
      const end = buffer.indexOf("\r\n\r\n");
      if (end === -1) return;
      done = true;
      buffer = buffer.subarray(end + 4);
    }
    for (;;) {
      if (buffer.length < 2) return;
      const fin = (buffer[0] & 0x80) !== 0;
      const opcode = buffer[0] & 0x0f;
      const masked = (buffer[1] & 0x80) !== 0;
      let length = buffer[1] & 0x7f;
      let offset = 2;
      if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4; }
      else if (length === 127) { if (buffer.length < 10) return; length = Number(buffer.readBigUInt64BE(2)); offset = 10; }
      let maskKey = null;
      if (masked) { if (buffer.length < offset + 4) return; maskKey = buffer.subarray(offset, offset + 4); offset += 4; }
      if (buffer.length < offset + length) return;
      let payload = buffer.subarray(offset, offset + length);
      if (maskKey) { const copy = Buffer.from(payload); for (let i = 0; i < copy.length; i += 1) copy[i] ^= maskKey[i % 4]; payload = copy; }
      buffer = buffer.subarray(offset + length);
      if (opcode === 8) { socket.end(); return; }
      if (opcode === 9) continue;
      leftovers = Buffer.concat([leftovers, payload]);
      if (!fin) continue;
      emit(leftovers.toString("utf8"));
      leftovers = Buffer.alloc(0);
    }
  });
  const send = (text) => {
    const payload = Buffer.from(text, "utf8");
    const mask = crypto.randomBytes(4);
    const masked = Buffer.from(payload);
    for (let i = 0; i < masked.length; i += 1) masked[i] ^= mask[i % 4];
    let header;
    if (payload.length < 126) { header = Buffer.alloc(2); header[1] = 0x80 | payload.length; }
    else if (payload.length < 65536) { header = Buffer.alloc(4); header[1] = 0x80 | 126; header.writeUInt16BE(payload.length, 2); }
    else { header = Buffer.alloc(10); header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(payload.length), 2); }
    header[0] = 0x81;
    socket.write(Buffer.concat([header, mask, masked]));
  };
  const ready = new Promise((res) => { const check = () => (done ? res() : setImmediate(check)); check(); });
  return { ready, send, onMessage: (fn) => listeners.push(fn), close: () => socket.destroy() };
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const edge = spawn(EDGE, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${OUT}/.profile`,
  "--disable-gpu",
  `--window-size=${WIDTH},${HEIGHT}`,
  "--hide-scrollbars",
  "about:blank",
]);
await new Promise((r) => setTimeout(r, 3000));
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const ws = connectWs(list.find((t) => t.type === "page").webSocketDebuggerUrl);
await ws.ready;
let id = 0;
const pending = new Map();
ws.onMessage((m) => {
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: WIDTH < 700 });
await send("Page.navigate", { url: URL_TO_SHOT });
await new Promise((r) => setTimeout(r, 5000));
const shot = await send("Page.captureScreenshot", { format: "png" });
await writeFile(OUT_FILE, Buffer.from(shot.result.data, "base64"));
log(`wrote ${OUT_FILE}`);
ws.close();
edge.kill();
process.exit(0);
