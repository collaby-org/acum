/**
 * The live frame, filed.
 *
 * `POST /api/stills` — the frame a browser drew out of the picture it is
 * already decoding, sent to the bucket it belongs in.
 *
 * The frame is captured on the client because that is where the decoded
 * picture is; everything that could be lied about is checked here instead.
 * What comes in is a multipart body with three things, and all three are
 * read twice — once to see whether they are shaped like what they claim,
 * and once to see whether they are worth writing:
 *
 *   - `channel` must be a channel that exists in the catalogue. An id
 *     invented in a console is not a channel, and a frame of a channel
 *     that does not exist has nowhere to belong.
 *   - `slot` must be the moment a programme started, in epoch
 *     milliseconds, inside a window a broadcast could actually fall in.
 *     It is not decoration: it *is* the filename, and therefore the
 *     address every card will later try.
 *   - `file` must be a JPEG, and it must be under the bucket's ceiling.
 *     The size is checked here rather than left to the bucket, because a
 *     refusal that says why is worth more than a storage error that only
 *     says "too large" after the bytes have already crossed the wire.
 *
 * The write itself runs on the service role, because a still belongs to
 * the channel and not to the visitor who happened to be watching — the
 * row level policies would otherwise make every frame private to whoever
 * took it, which is exactly the wrong way round for a picture the whole
 * catalogue is supposed to show. What the service role is *not* handed is
 * the decision of who may take a frame: that is the session, verified
 * against the auth server, and nothing else.
 *
 * There is no `dynamic` or `runtime` export here. A route that reads a
 * body is per-request by its own nature, and the build refuses those
 * declarations outright.
 */
import {
  bearerToken,
  getServiceClient,
  hasServiceRole,
  readUser,
} from "@/lib/supabase/server";
import { CHANNELS } from "@/data/channels";
import {
  STILLS_BUCKET,
  STILL_MAX_BYTES,
  stillKey,
  stillUrl,
} from "@/lib/stills";

/** The catalogue's own ids: the only channels a frame may belong to. */
const CATALOGUE = new Set(CHANNELS.map((channel) => channel.id));

/** The answer a refusal gives, in the shape the capture hook reads. */
function refusal(error: string, status: number): Response {
  return Response.json(
    { error },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return refusal("Autentifică-te pentru a trimite un cadru.", 401);
  }

  const user = await readUser(token);
  if (!user) {
    return refusal("Sesiunea a expirat. Autentifică-te din nou.", 401);
  }

  // A bucket nobody configured is a readable sentence, not a thrown key.
  if (!hasServiceRole()) {
    return refusal("Depozitul de capturi nu este configurat pe server.", 503);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return refusal("Trimite cadrul ca multipart/form-data.", 400);
  }

  const channel = form.get("channel");
  const slot = form.get("slot");
  const file = form.get("file");

  const channelId = typeof channel === "string" ? channel.trim() : "";
  if (channelId.length === 0) {
    return refusal("Lipsește canalul din care vine cadrul.", 400);
  }
  if (!CATALOGUE.has(channelId)) {
    return refusal(`Canalul „${channelId}” nu este în catalog.`, 400);
  }

  // The slot is the filename. A frame filed under a slot nobody can
  // compute is a frame no card will ever ask for.
  const path = stillKey(channelId, slot);
  if (!path) {
    return refusal(
      "Slotul trebuie să fie momentul de început al programei, în milisecunde.",
      400,
    );
  }

  if (!(file instanceof Blob)) {
    return refusal("Lipsește cadrul.", 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Said here, before the bytes are handed to storage that would refuse
  // them anyway. The client resizes to 640×360 at quality 0.72 and lands
  // far under this; a request that does not is not a frame of a broadcast.
  if (bytes.byteLength === 0) {
    return refusal("Cadrul este gol.", 400);
  }
  if (bytes.byteLength > STILL_MAX_BYTES) {
    return refusal(
      `Cadrul are ${bytes.byteLength} octeți, iar depozitul nu ia mai mult de ${STILL_MAX_BYTES}.`,
      413,
    );
  }

  // The JPEG start-of-image marker. The bucket takes jpeg and webp, but a
  // frame drawn on a canvas is a jpeg — anything else is something else
  // wearing a jpeg filename.
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    return refusal("Cadrul nu este un JPEG.", 400);
  }

  const { error } = await getServiceClient()
    .storage.from(STILLS_BUCKET)
    .upload(path, bytes, { contentType: "image/jpeg", upsert: true });

  if (error) {
    return refusal("Cadrul nu a putut fi depozitat.", 500);
  }

  // The address is answered rather than read back: it is the one the card
  // computes from the same slot, so a mismatch here would mean the two
  // sides of the pipeline disagree about what a slot is.
  const url = stillUrl(channelId, slot);
  if (!url) {
    return refusal("Proiectul nu are o adresă publică.", 500);
  }

  return Response.json(
    { url, path, bytes: bytes.byteLength },
    { headers: { "cache-control": "no-store" } },
  );
}
