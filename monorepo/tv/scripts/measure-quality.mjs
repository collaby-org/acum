/**
 * Stream quality measurement.
 *
 * Reads data/resolved-streams.json and measures the picture height of every
 * resolved HLS feed, so the catalogue can tell an HD feed from an SD one,
 * prefer the HD feed of a channel and label the channel as HD.
 *
 *   node scripts/measure-quality.mjs             every feed in the catalogue
 *   node scripts/measure-quality.mjs protv an1   only these feeds
 *
 * Writes data/quality.json:
 *   { "generatedAt": "…", "counts": { … }, "feeds": { "<slug>": { … } } }
 *
 * The upstream gates every playlist on a Referer and answers a request it
 * does not like with a redirect to Google, so the requests go out one at a
 * time, spaced out, and every response is checked before it is believed.
 *
 * Node built-ins only.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";

/** The site the upstream player pages live on; the second Referer. */
const UPSTREAM_REFERER = "https://canale-tv.net/";

/** The site that publishes the feeds; the last Referer. */
const PUBLISHER_REFERER = "https://www.cool-etv.net/";
/** The second source's media host answers only with this Referer. */
const SECONDARY_REFERER = "https://canaletvlive.online/";

/** The gap between two requests. A burst is what trips the upstream's bot window. */
const REQUEST_DELAY_MS = 1000;

/** The gap before a second attempt at a request that failed. */
const RETRY_DELAY_MS = 2500;

/** The answers that mean "try again", not "give up". */
const RETRYABLE_STATUS = new Set([404, 408, 425, 429, 500, 502, 503, 504]);

const REQUEST_TIMEOUT_MS = 15000;
const SEGMENT_TIMEOUT_MS = 25000;

/** A segment is cut short once the picture header has been read. */
const SEGMENT_BYTE_BUDGET = 512 * 1024;

/* ------------------------------------------------------------------ *
 * The quality ladder
 * ------------------------------------------------------------------ */
/**
 * The bands, from the broadcast names down to the web ones.
 *
 * 480p counts as SD — it is the standard definition — and everything below
 * it is "low".
 */
const QUALITY_BANDS = [
  { quality: "uhd", minHeight: 2000 },
  { quality: "fhd", minHeight: 1000 },
  { quality: "hd", minHeight: 700 },
  { quality: "sd", minHeight: 460 },
  { quality: "low", minHeight: 0 },
];

const QUALITY_ORDER = ["uhd", "fhd", "hd", "sd", "low", "unknown"];

/**
 * The height a codec level allows, when the stream itself cannot be read.
 *
 * The upstream advertises `avc1.64001f` — High profile, level 3.1 — for
 * every feed it serves, and that level caps at 720p, so a 576p feed wears
 * the same label as a 720p one. The table can therefore only ever be a last
 * resort: the height is read out of the stream whenever a segment can be
 * fetched.
 */
const CODEC_HEIGHT = {
  /** AVC level_idc (the last two hex digits) → nominal height. */
  avc: {
    "10": 288,
    "11": 288,
    "12": 288,
    "13": 288,
    "20": 576,
    "21": 576,
    "22": 576,
    "30": 576,
    "31": 720,
    "32": 1080,
    "40": 1080,
    "41": 1080,
    "42": 1080,
    "50": 2160,
    "51": 2160,
    "52": 2160,
    "60": 2160,
  },
  /** HEVC general_level_idc → nominal height. */
  hevc: {
    "60": 576,
    "63": 576,
    "90": 576,
    "93": 720,
    "120": 1080,
    "123": 1080,
    "150": 2160,
    "153": 2160,
    "180": 2160,
  },
  /** AV1 seq_level_idx_0 → nominal height. */
  av1: {
    "04": 576,
    "05": 720,
    "08": 1080,
    "13": 2160,
  },
  /** MPEG-2 video: the profile/level pair only reaches high definition. */
  mp4v: {
    "20": 1080,
  },
};

/** The height a bitrate buys, when neither the stream nor the codec says. */
const BANDWIDTH_HEIGHT = [
  { minBandwidth: 6_000_000, height: 1080 },
  { minBandwidth: 2_500_000, height: 720 },
  { minBandwidth: 1_200_000, height: 576 },
  { minBandwidth: 700_000, height: 480 },
  { minBandwidth: 300_000, height: 360 },
  { minBandwidth: 0, height: 240 },
];

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const hostOf = (url) => {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
};

const absolutize = (uri, base) => {
  try {
    return new URL(uri, base).toString();
  } catch {
    return uri;
  }
};

const isPlaylist = (body) => body.trimStart().startsWith("#EXTM3U");

/** True when the upstream sent us to Google instead of the bytes. */
const isGoogleRedirect = (url) => /(^|\/\/|\.)google\.[a-z.]+/i.test(url);

/** A readable name for a network failure. */
function describeNetworkError(error) {
  const cause = error?.cause;
  const code = cause?.code ?? "";
  switch (code) {
    case "ENOTFOUND":
      return "the host does not resolve";
    case "ECONNREFUSED":
      return "the host refused the connection";
    case "ECONNRESET":
      return "the host reset the connection";
    case "ETIMEDOUT":
      return "the request timed out";
    case "CERT_HAS_EXPIRED":
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
    case "DEPTH_ZERO_SELF_SIGNED_CERT":
      return "the TLS certificate did not verify";
    default:
      break;
  }
  if (error?.name === "TimeoutError" || error?.name === "AbortError") {
    return "the request timed out";
  }
  return `the request failed (${code || error?.message || "unknown"})`;
}

/* ------------------------------------------------------------------ *
 * Talking to the upstream
 * ------------------------------------------------------------------ */

/** The Referers a host accepts, the one that worked last time first. */
const refererCache = new Map();

function referersFor(url) {
  const chain = [];
  try {
    chain.push(`${new URL(url).origin}/`);
  } catch {
    /* the caller validated the URL */
  }
  chain.push(UPSTREAM_REFERER, PUBLISHER_REFERER, SECONDARY_REFERER);
  const unique = [...new Set(chain)];
  const cached = refererCache.get(hostOf(url));
  return cached ? [cached, ...unique.filter((referer) => referer !== cached)] : unique;
}

/** Read a response body, cut off after `budget` bytes. */
async function readBytes(response, budget) {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
      size += value.byteLength;
      if (size >= budget) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks);
}

/**
 * One upstream request.
 *
 * A redirect to Google means the Referer was refused; any other redirect is
 * followed here so that the Referer stays on it.
 */
async function requestOnce(url, referer, { accept = "*/*", timeout = REQUEST_TIMEOUT_MS, budget } = {}) {
  let response;
  try {
    response = await fetch(url, {
      headers: { "user-agent": UA, referer, accept },
      redirect: "manual",
      signal: AbortSignal.timeout(timeout),
    });
  } catch (error) {
    return { ok: false, reason: describeNetworkError(error), retryable: true };
  }

  const location = response.headers.get("location");
  if (response.status >= 300 && response.status < 400) {
    if (!location) {
      return { ok: false, reason: `HTTP ${response.status} without a target`, retryable: false };
    }
    if (isGoogleRedirect(location)) {
      return {
        ok: false,
        reason: "the host redirected to Google instead of the playlist",
        retryable: false,
      };
    }
    const next = absolutize(location, url);
    if (next === url) {
      return { ok: false, reason: "the host redirected to itself", retryable: false };
    }
    return requestOnce(next, referer, { accept, timeout, budget });
  }

  if (!response.ok) {
    const reason =
      response.status === 403
        ? "the host blocked the request (HTTP 403)"
        : `the host answered HTTP ${response.status}`;
    return { ok: false, reason, retryable: RETRYABLE_STATUS.has(response.status) };
  }

  const bytes = await readBytes(response, budget ?? Number.MAX_SAFE_INTEGER);
  return { ok: true, status: response.status, bytes };
}

/**
 * One upstream request, with a second attempt for the failures that are
 * worth another try.
 *
 * The upstream rotates the playlist files while it serves them, so a feed
 * that answers 404 answers with a playlist a moment later.
 */
async function requestUpstream(url, referer, options = {}) {
  const attempts = options.attempts ?? 2;
  let reason = "the request failed";
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS);
    const result = await requestOnce(url, referer, options);
    if (result.ok) return result;
    reason = result.reason;
    if (!result.retryable) break;
  }
  return { ok: false, reason };
}

/**
 * The playlist behind a URL, with the first Referer the host accepts.
 *
 * The host answers a refused Referer with a redirect to Google and a
 * half-accepted one with an HTML cloaking page, so a body is only a
 * playlist when it says so.
 */
async function fetchPlaylist(url, { timeout = REQUEST_TIMEOUT_MS } = {}) {
  let reason = "no Referer was accepted";
  for (const referer of referersFor(url)) {
    await sleep(REQUEST_DELAY_MS);
    const result = await requestUpstream(url, referer, {
      accept: "application/vnd.apple.mpegurl,application/x-mpegurl,*/*",
      timeout,
    });
    if (!result.ok) {
      reason = result.reason;
      continue;
    }
    const body = result.bytes.toString("utf8");
    if (isPlaylist(body)) {
      refererCache.set(hostOf(url), referer);
      return { ok: true, body, referer };
    }
    reason = body.trimStart().startsWith("<")
      ? "the host answered with a cloaking page"
      : "the body is not a playlist";
  }
  return { ok: false, reason };
}

/* ------------------------------------------------------------------ *
 * Reading a playlist
 * ------------------------------------------------------------------ */

/** The attributes of an `#EXT-X-STREAM-INF` line. */
function parseAttributes(text) {
  const attributes = {};
  const pattern = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    attributes[match[1]] = match[2].replace(/^"|"$/g, "");
  }
  return attributes;
}

/** The variants of a master playlist, with the line each one came from. */
function parseVariants(body) {
  const variants = [];
  let pending = null;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      pending = {
        line,
        attributes: parseAttributes(line.slice("#EXT-X-STREAM-INF:".length)),
      };
      continue;
    }
    if (line.startsWith("#")) continue;
    if (pending) {
      variants.push({ ...pending, uri: line });
      pending = null;
    }
  }
  return variants;
}

/** The segment URIs of a media playlist. */
function parseSegments(body) {
  const segments = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    segments.push(line);
  }
  return segments;
}

/** The variant with the most bandwidth. */
function pickHighestBandwidth(variants) {
  if (!variants.length) return null;
  let best = variants[0];
  let bestBandwidth = -1;
  for (const variant of variants) {
    const bandwidth = Number(
      variant.attributes.BANDWIDTH ?? variant.attributes["AVERAGE-BANDWIDTH"] ?? 0,
    );
    if (Number.isFinite(bandwidth) && bandwidth > bestBandwidth) {
      best = variant;
      bestBandwidth = bandwidth;
    }
  }
  return best;
}

/** The `RESOLUTION=WxH` attribute of a variant, when it has one. */
function parseResolution(value) {
  const match = /^(\d+)x(\d+)$/.exec(String(value ?? "").trim());
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

/* ------------------------------------------------------------------ *
 * Reading the picture out of the stream
 * ------------------------------------------------------------------ */
/** Removes the emulation prevention bytes an RBSP carries. */
function removeEmulationPrevention(buffer) {
  const out = Buffer.alloc(buffer.length);
  let written = 0;
  let zeros = 0;
  for (const byte of buffer) {
    if (zeros === 2 && byte === 3) {
      zeros = 0;
      continue;
    }
    out[written++] = byte;
    zeros = byte === 0 ? zeros + 1 : 0;
  }
  return out.subarray(0, written);
}

class BitReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.position = 0;
    this.bit = 0;
  }
  readBit() {
    const byte = this.bytes[this.position] ?? 0;
    const value = (byte >> (7 - this.bit)) & 1;
    this.bit += 1;
    if (this.bit === 8) {
      this.bit = 0;
      this.position += 1;
    }
    return value;
  }
  readBits(count) {
    let value = 0;
    for (let i = 0; i < count; i++) value = value * 2 + this.readBit();
    return value;
  }
  /** An unsigned Exp-Golomb number. */
  readUnsigned() {
    let zeros = 0;
    while (this.readBit() === 0 && zeros < 32) zeros++;
    if (zeros === 0) return 0;
    return 2 ** zeros - 1 + this.readBits(zeros);
  }
  /** A signed Exp-Golomb number. */
  readSigned() {
    const value = this.readUnsigned();
    return value % 2 === 0 ? -(value / 2) : (value + 1) / 2;
  }
}

/** The picture size an H.264 sequence parameter set describes. */
function parseSps(rbsp) {
  const reader = new BitReader(rbsp);
  const profileIdc = reader.readBits(8);
  reader.readBits(8);
  const levelIdc = reader.readBits(8);
  reader.readUnsigned();

  let chromaFormatIdc = 1;
  if ([100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135].includes(profileIdc)) {
    chromaFormatIdc = reader.readUnsigned();
    if (chromaFormatIdc === 3) reader.readBit();
    reader.readUnsigned();
    reader.readUnsigned();
    reader.readBit();
    if (reader.readBit()) {
      const count = chromaFormatIdc !== 3 ? 8 : 12;
      for (let i = 0; i < count; i++) {
        if (!reader.readBit()) continue;
        let size = 16;
        let last = 8;
        let next = 8;
        for (let j = 0; j < size; j++) {
          if (next !== 0) {
            const delta = reader.readSigned();
            next = (last + delta + 256) % 256;
          }
          if (next !== 0) last = next;
        }
      }
    }
  }

  reader.readUnsigned();
  const picOrderCntType = reader.readUnsigned();
  if (picOrderCntType === 0) {
    reader.readUnsigned();
  } else if (picOrderCntType === 1) {
    reader.readBit();
    reader.readSigned();
    reader.readSigned();
    const count = reader.readUnsigned();
    for (let i = 0; i < count; i++) reader.readSigned();
  }
  reader.readUnsigned();
  reader.readBit();

  const picWidthInMbsMinus1 = reader.readUnsigned();
  const picHeightInMapUnitsMinus1 = reader.readUnsigned();
  const frameMbsOnlyFlag = reader.readBit();
  if (!frameMbsOnlyFlag) reader.readBit();
  reader.readBit();

  let cropLeft = 0;
  let cropRight = 0;
  let cropTop = 0;
  let cropBottom = 0;
  if (reader.readBit()) {
    cropLeft = reader.readUnsigned();
    cropRight = reader.readUnsigned();
    cropTop = reader.readUnsigned();
    cropBottom = reader.readUnsigned();
  }

  const cropUnitX = chromaFormatIdc === 0 ? 1 : chromaFormatIdc === 3 ? 1 : 2;
  const cropUnitY =
    (chromaFormatIdc === 0 ? 1 : chromaFormatIdc === 1 ? 2 : 1) * (2 - frameMbsOnlyFlag);
  const width = (picWidthInMbsMinus1 + 1) * 16 - (cropLeft + cropRight) * cropUnitX;
  const height =
    (2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16 - (cropTop + cropBottom) * cropUnitY;

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height, profileIdc, levelIdc };
}

/** The MPEG-TS packets of a buffer, aligned on the sync byte. */
function tsPackets(buffer) {
  let start = -1;
  const limit = Math.min(buffer.length, 188 * 4);
  for (let i = 0; i < limit; i++) {
    if (buffer[i] === 0x47 && i + 188 <= buffer.length && buffer[i + 188] === 0x47) {
      start = i;
      break;
    }
  }
  if (start === -1) return [];
  const packets = [];
  for (let offset = start; offset + 188 <= buffer.length; offset += 188) {
    if (buffer[offset] !== 0x47) break;
    packets.push(buffer.subarray(offset, offset + 188));
  }
  return packets;
}

/** The payload of a transport stream packet. */
function packetPayload(packet) {
  const pid = ((packet[1] & 0x1f) << 8) | packet[2];
  const startsNewPayload = (packet[1] & 0x40) !== 0;
  const hasAdaptation = (packet[3] & 0x20) !== 0;
  let offset = 4;
  if (hasAdaptation) offset += 1 + packet[4];
  return { pid, startsNewPayload, payload: packet.subarray(offset) };
}

/**
 * The picture size inside an MPEG-TS segment.
 *
 * The video PID comes from the program map table, the elementary stream out
 * of the PES packets, and the size out of the sequence parameter set.
 */
function pictureFromTs(buffer) {
  const packets = tsPackets(buffer);
  if (!packets.length) return null;

  let pmtPid = -1;
  let videoPid = -1;

  for (const packet of packets) {
    const { pid, payload } = packetPayload(packet);
    if (!payload.length) continue;

    if (pid === 0) {
      const section = payload.subarray(1 + payload[0]);
      if (section[0] === 0) {
        pmtPid = ((section[10] & 0x1f) << 8) | section[11];
      }
      continue;
    }

    if (pmtPid === -1 || pid !== pmtPid) continue;
    const section = payload.subarray(1 + payload[0]);
    const sectionLength = ((section[1] & 0x0f) << 8) | section[2];
    const programInfoLength = ((section[10] & 0x0f) << 8) | section[11];
    let cursor = 12 + programInfoLength;
    const end = 3 + sectionLength;
    while (cursor + 4 < end) {
      const streamType = section[cursor];
      const elementaryPid = ((section[cursor + 1] & 0x1f) << 8) | section[cursor + 2];
      const elementaryInfoLength =
        ((section[cursor + 3] & 0x0f) << 8) | section[cursor + 4];
      if (streamType === 0x1b) {
        videoPid = elementaryPid;
        break;
      }
      cursor += 5 + elementaryInfoLength;
    }
    if (videoPid !== -1) break;
  }

  if (videoPid === -1) return null;

  const chunks = [];
  for (const packet of packets) {
    const { pid, payload } = packetPayload(packet);
    if (pid !== videoPid || !payload.length) continue;
    if (payload[0] === 0 && payload[1] === 0 && payload[2] === 1) {
      const headerDataLength = payload[8];
      chunks.push(payload.subarray(9 + headerDataLength));
    } else {
      chunks.push(payload);
    }
  }
  if (!chunks.length) return null;

  const elementary = Buffer.concat(chunks);
  for (let i = 0; i + 4 < elementary.length; i++) {
    if (elementary[i] !== 0 || elementary[i + 1] !== 0 || elementary[i + 2] !== 1) continue;
    if ((elementary[i + 3] & 0x1f) !== 7) continue;
    const rbsp = removeEmulationPrevention(elementary.subarray(i + 4));
    const sps = parseSps(rbsp);
    if (sps) return sps;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * The fallback ladders
 * ------------------------------------------------------------------ */
/** The nominal height the advertised codec allows. */
function heightFromCodecs(codecs) {
  for (const codec of String(codecs ?? "")
    .split(",")
    .map((part) => part.trim().toLowerCase())) {
    if (codec.startsWith("avc1.")) {
      // level_idc is the last byte of the codec string, in hex.
      const hex = /^[0-9a-f]{4}([0-9a-f]{2})$/.exec(codec.slice(5))?.[1];
      const level = hex ? Number.parseInt(hex, 16) : null;
      const height = level === null ? undefined : CODEC_HEIGHT.avc[String(level)];
      if (height) return { height, detail: `avc level ${level}` };
    }
    if (codec.startsWith("hvc1.") || codec.startsWith("hev1.")) {
      const match = /\.l(\d{2,3})\b/.exec(codec);
      const level = match?.[1];
      const height = level ? CODEC_HEIGHT.hevc[level] : undefined;
      if (height) return { height, detail: `hevc level ${level}` };
    }
    if (codec.startsWith("av01.")) {
      const match = /\.0\.(\d{2})/.exec(codec);
      const level = match?.[1];
      const height = level ? CODEC_HEIGHT.av1[level] : undefined;
      if (height) return { height, detail: `av1 level ${level}` };
    }
    if (codec.startsWith("mp4v.")) {
      const profile = codec.slice(5, 7);
      const height = CODEC_HEIGHT.mp4v[profile];
      if (height) return { height, detail: `mpeg-2 profile ${profile}` };
    }
  }
  return null;
}

/** The nominal height the advertised bandwidth buys. */
function heightFromBandwidth(bandwidth) {
  if (!Number.isFinite(bandwidth) || bandwidth <= 0) return null;
  const band = BANDWIDTH_HEIGHT.find((entry) => bandwidth >= entry.minBandwidth);
  return band ? { height: band.height, detail: `${bandwidth} bit/s` } : null;
}

const qualityOf = (height) =>
  QUALITY_BANDS.find((band) => height >= band.minHeight)?.quality ?? "unknown";

/** How the picture size of a segment was read, for the record. */
const describePicture = (picture) =>
  `SPS ${picture.width}x${picture.height} (profile ${picture.profileIdc}, level ${picture.levelIdc})`;

/* ------------------------------------------------------------------ *
 * Measuring one feed
 * ------------------------------------------------------------------ */

/**
 * The picture size of a segment, read out of its sequence parameter set.
 *
 * The segment lives on the host of the playlist it belongs to and is gated
 * the same way, so the Referer that opened the playlist opens it too.
 */
async function measureSegment(segmentUrl, referer) {
  const chain = referersFor(segmentUrl);
  const ordered = referer ? [referer, ...chain.filter((item) => item !== referer)] : chain;
  let reason = "no Referer was accepted";
  for (const candidate of ordered) {
    await sleep(REQUEST_DELAY_MS);
    const result = await requestUpstream(segmentUrl, candidate, {
      accept: "*/*",
      timeout: SEGMENT_TIMEOUT_MS,
      budget: SEGMENT_BYTE_BUDGET,
    });
    if (!result.ok) {
      reason = result.reason;
      continue;
    }
    const picture = pictureFromTs(result.bytes);
    if (!picture) return { ok: false, reason: "the segment carries no picture header" };
    return { ok: true, picture };
  }
  return { ok: false, reason };
}

/**
 * The picture size of a media playlist, read from the segments it lists.
 *
 * The first and the last segment are tried: the first one is the oldest
 * live window and the last one is the live edge.
 */
async function measureFromSegments(segments, baseUrl, referer) {
  if (!segments.length) return { ok: false, reason: "the playlist lists no segment" };
  const candidates = [segments[0]];
  if (segments.length > 2) candidates.push(segments[segments.length - 1]);
  if (segments.length > 1) candidates.push(segments[Math.floor(segments.length / 2)]);

  let reason = "no segment could be read";
  for (const segment of candidates) {
    const segmentUrl = absolutize(segment, baseUrl);
    const result = await measureSegment(segmentUrl, referer);
    if (result.ok) return { ok: true, picture: result.picture, segmentUrl };
    reason = result.reason;
  }
  return { ok: false, reason };
}

/**
 * The quality of one HLS feed.
 *
 * The height is taken from the playlist when the upstream spells it out,
 * then from the stream itself, then from the advertised codec, then from
 * the advertised bandwidth.
 */
async function measureFeed(hlsUrl) {
  const master = await fetchPlaylist(hlsUrl);
  if (!master.ok) {
    return {
      quality: "unknown",
      width: null,
      height: null,
      source: "unknown",
      basis: master.reason,
      reason: master.reason,
    };
  }

  const variants = parseVariants(master.body);
  const best = pickHighestBandwidth(variants);

  if (!best) {
    // The URL is a media playlist: the picture sits in its segments.
    const measured = await measureFromSegments(parseSegments(master.body), hlsUrl, master.referer);
    if (measured.ok) {
      return {
        quality: qualityOf(measured.picture.height),
        width: measured.picture.width,
        height: measured.picture.height,
        source: "segment",
        basis: describePicture(measured.picture),
        reason: null,
        variantUrl: null,
        variantLine: null,
        segmentUrl: measured.segmentUrl,
        bandwidth: null,
        codecs: null,
        referer: master.referer,
      };
    }
    return {
      quality: "unknown",
      width: null,
      height: null,
      source: "unknown",
      basis: measured.reason,
      reason: measured.reason,
      variantUrl: null,
      variantLine: null,
      segmentUrl: null,
      bandwidth: null,
      codecs: null,
      referer: master.referer,
    };
  }

  const variantUrl = absolutize(best.uri, hlsUrl);
  const bandwidth = Number(
    best.attributes.BANDWIDTH ?? best.attributes["AVERAGE-BANDWIDTH"] ?? 0,
  );
  const codecs = best.attributes.CODECS ?? null;

  const base = {
    variantUrl,
    variantLine: best.line,
    segmentUrl: null,
    bandwidth: Number.isFinite(bandwidth) ? bandwidth : null,
    codecs,
    referer: master.referer,
  };

  const declared = parseResolution(best.attributes.RESOLUTION);
  if (declared) {
    return {
      ...base,
      quality: qualityOf(declared.height),
      width: declared.width,
      height: declared.height,
      source: "resolution",
      basis: `RESOLUTION=${declared.width}x${declared.height}`,
      reason: null,
    };
  }

  const variant = await fetchPlaylist(variantUrl);
  if (!variant.ok) {
    return {
      ...base,
      quality: "unknown",
      width: null,
      height: null,
      source: "unknown",
      basis: variant.reason,
      reason: variant.reason,
    };
  }

  const nested = pickHighestBandwidth(parseVariants(variant.body));
  if (nested) {
    const nestedResolution = parseResolution(nested.attributes.RESOLUTION);
    if (nestedResolution) {
      return {
        ...base,
        variantUrl: absolutize(nested.uri, variantUrl),
        variantLine: nested.line,
        quality: qualityOf(nestedResolution.height),
        width: nestedResolution.width,
        height: nestedResolution.height,
        source: "resolution",
        basis: `RESOLUTION=${nestedResolution.width}x${nestedResolution.height}`,
        reason: null,
      };
    }
  }

  const measured = await measureFromSegments(parseSegments(variant.body), variantUrl, variant.referer);
  if (measured.ok) {
    return {
      ...base,
      segmentUrl: measured.segmentUrl,
      quality: qualityOf(measured.picture.height),
      width: measured.picture.width,
      height: measured.picture.height,
      source: "segment",
      basis: describePicture(measured.picture),
      reason: null,
    };
  }

  const fromCodec = heightFromCodecs(codecs);
  const nominal = fromCodec ?? heightFromBandwidth(bandwidth);
  if (nominal) {
    if (process.env.QUALITY_DEBUG) console.error(`  ! ${hlsUrl}: ${measured.reason}`);
    return {
      ...base,
      quality: qualityOf(nominal.height),
      width: null,
      height: nominal.height,
      source: fromCodec ? "codec" : "bandwidth",
      basis: `${nominal.detail} (the stream itself could not be read)`,
      reason: null,
    };
  }

  return {
    ...base,
    quality: "unknown",
    width: null,
    height: null,
    source: "unknown",
    basis: measured.reason,
    reason: measured.reason,
  };
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */
const USAGE = `
Usage: node scripts/measure-quality.mjs [options] [slug ...]

  Measures the picture height of every resolved HLS feed.

Arguments:
  slug ...        Feed slugs to measure. Without arguments every feed in
                  data/resolved-streams.json is measured.

Options:
  --out <file>    Output file. Default: data/quality.json
  --help          Show this message
`.trim();

const argv = process.argv.slice(2);
const requested = [];
let outPath = resolve(ROOT, "data/quality.json");
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === "--help" || arg === "-h") {
    console.log(USAGE);
    process.exit(0);
  }
  if (arg === "--out") {
    outPath = resolve(ROOT, argv[++i]);
    continue;
  }
  if (arg.startsWith("--")) {
    console.error(`unknown option: ${arg}\n${USAGE}`);
    process.exit(2);
  }
  requested.push(arg);
}

const streamsPath = resolve(ROOT, "data/resolved-streams.json");

let streams;
try {
  streams = JSON.parse(await readFile(streamsPath, "utf8"));
} catch (error) {
  console.error(`[quality] cannot read ${streamsPath}: ${error?.message || error}`);
  process.exit(1);
}

const slugs = requested.length
  ? requested
  : Object.keys(streams).sort();

const missing = slugs.filter((slug) => !streams[slug]);
if (missing.length) {
  console.warn(`[quality] ${missing.length} slug(s) are not in the catalogue: ${missing.join(", ")}`);
}

const feeds = {};
const counts = Object.fromEntries(QUALITY_ORDER.map((quality) => [quality, 0]));
const reasons = new Map();
/** The same playlist behind several feeds is measured once. */
const measured = new Map();

let done = 0;
for (const slug of slugs) {
  const entry = streams[slug];
  if (!entry) {
    done++;
    continue;
  }

  let record;
  if (measured.has(entry.hlsUrl)) {
    record = measured.get(entry.hlsUrl);
  } else {
    record = await measureFeed(entry.hlsUrl);
    measured.set(entry.hlsUrl, record);
  }

  const checkedAt = new Date().toISOString();
  feeds[slug] = {
    quality: record.quality,
    width: record.width ?? null,
    height: record.height ?? null,
    source: record.source,
    basis: record.basis ?? null,
    reason: record.reason ?? null,
    hlsUrl: entry.hlsUrl,
    variantUrl: record.variantUrl ?? null,
    variantLine: record.variantLine ?? null,
    segmentUrl: record.segmentUrl ?? null,
    bandwidth: record.bandwidth ?? null,
    codecs: record.codecs ?? null,
    referer: record.referer ?? null,
    checkedAt,
  };

  counts[record.quality] = (counts[record.quality] ?? 0) + 1;
  if (record.quality === "unknown") {
    const reason = record.reason ?? "unknown";
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }

  done++;
  const size = record.width && record.height ? `${record.width}x${record.height}` : "—";
  console.log(
    `  ${slug.padEnd(20)} ${record.quality.padEnd(7)} ${size.padEnd(9)} ${record.source}`,
  );
  if (done % 20 === 0) {
    console.log(`  … ${done}/${slugs.length} feeds`);
  }
}

await mkdir(dirname(outPath), { recursive: true });
await writeFile(
  outPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), counts, feeds }, null, 2)}\n`,
  "utf8",
);

console.log(
  `\n[quality] ${slugs.length} feeds · ${measured.size} unique playlists · ${counts.uhd} uhd · ${counts.fhd} fhd · ${counts.hd} hd · ${counts.sd} sd · ${counts.low} low · ${counts.unknown} unknown`,
);
if (reasons.size) {
  console.log("[quality] why a feed is unknown:");
  for (const [reason, count] of [...reasons].sort((a, b) => b[1] - a[1])) {
    console.log(`   - ${reason} × ${count}`);
  }
}
console.log(`[quality] wrote ${outPath}`);
