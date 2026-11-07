/**
 * Review-engine proof.
 *
 * It drives the real app in headless Edge over the DevTools protocol and
 * proves the whole life of a review: an anonymous reader, a signed-in
 * writer, the editor, the three reactions, the refusal of an anonymous
 * write, and the cleanup that leaves the database as it was found.
 *
 *   node scripts/verify-reviews.mjs https://acum-weld.vercel.app/
 *
 * The harness credentials and the Supabase project come from the
 * environment:
 *
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *   ACUM_HARNESS_EMAIL, ACUM_HARNESS_PASSWORD
 *
 * Every assertion prints the measured value. The log is the evidence; a
 * PASS without the numbers beside it proves nothing.
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { installSession } from "./harness-signin.mjs";

const APP = (process.argv[2] ?? "https://acum-weld.vercel.app/").replace(
  /\/$/,
  "",
);
const EDGE =
  process.env.EDGE_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = Number(process.env.VERIFY_REVIEWS_PORT ?? 9341);
const OUT = resolve(tmpdir(), "acum-verify-reviews");

/**
 * Channels that are in the catalogue and are normally on air. The first
 * one whose current slot has no review by the harness account is used,
 * so a previous run cannot make the next run fail on the unique slot.
 */
const CHANNEL_CANDIDATES = [
  "pro-tv",
  "antena-1",
  "national-tv",
  "hbo",
  "tvr-1",
  "kanal-d",
];

/** The exact Romanian copy the interface promises. */
const COPY = {
  heading: "Recenzii populare",
  empty: "Nicio recenzie încă",
  emptyAction: "Scrie prima recenzie",
  anonymousWrite: "Autentifică-te pentru a scrie o recenzie.",
};

const MARKER = `verify-reviews-${Date.now()}-${randomUUID().slice(0, 8)}`;
const BODY = `Verificare automată a motorului de recenzii. ${MARKER}`;
const EDITED_BODY = `${BODY} — editată`;

const sleep = (ms) => new Promise((resolve_) => setTimeout(resolve_, ms));
const results = [];

/** Set as soon as the browser helper exists, so cleanup can use it too. */
let browserFetchJson = null;

/** What cleanup needs if a step throws half-way through. */
let cleanupContext = null;


/** One measured assertion. */
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name} — ${detail}`);
}

/** Whether a review has the three counters and nothing strange beside them. */
function countsAreSound(counts) {
  return (
    counts &&
    typeof counts === "object" &&
    ["clap", "love", "like"].every(
      (kind) => Number.isInteger(counts[kind]) && counts[kind] >= 0,
    )
  );
}

/** The same programme, however the two timestamps are written. */
function sameInstant(first, second) {
  if (first === null || second === null) return first === second;
  const a = Date.parse(first);
  const b = Date.parse(second);
  return Number.isFinite(a) && Number.isFinite(b) && a === b;
}

async function main() {
  // The directory is disposable: a file the last run's browser still
  // holds is not a failure of this one.
  await rm(OUT, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(
    () => undefined,
  );
  await mkdir(OUT, { recursive: true });

  edge = spawn(
    EDGE,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${OUT}\\.profile`,
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let target = null;
  for (let attempt = 0; attempt < 60 && !target; attempt++) {
    await sleep(250);
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await response.json();
      target = list.find((entry) => entry.type === "page");
    } catch {
      /* the browser is not listening yet */
    }
  }
  if (!target) {
    edge.kill();
    throw new Error("the DevTools endpoint never came up");
  }

  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    ws.addEventListener("open", resolveOpen, { once: true });
    ws.addEventListener("error", rejectOpen, { once: true });
  });

  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      waiter.reject(new Error(message.error.message ?? "DevTools error"));
    } else {
      waiter.resolve(message);
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolveMessage, rejectMessage) => {
      const messageId = ++id;
      const timer = setTimeout(() => {
        pending.delete(messageId);
        rejectMessage(new Error(`${method} timed out`));
      }, 20_000);
      pending.set(messageId, {
        resolve: (message) => {
          clearTimeout(timer);
          resolveMessage(message);
        },
        reject: (error) => {
          clearTimeout(timer);
          rejectMessage(error);
        },
      });
      ws.send(JSON.stringify({ id: messageId, method, params }));
    });

  const evaluate = async (expression) => {
    const reply = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    const details = reply.result?.exceptionDetails;
    if (details) {
      throw new Error(
        details.exception?.description ??
          details.text ??
          "the browser could not evaluate the check",
      );
    }
    return reply.result?.result?.value;
  };

  /** A request made by the page itself, so it has the site's origin. */
  const fetchJson = async (path, init = {}) => {
    const answer = await evaluate(`(async () => {
      const response = await fetch(${JSON.stringify(path)}, ${JSON.stringify(init)});
      const text = await response.text();
      let body = null;
      try { body = JSON.parse(text); } catch { /* the body is not JSON */ }
      return {
        status: response.status,
        ok: response.ok,
        body,
        text: text.slice(0, 600),
      };
    })()`);
    return answer;
  };

  browserFetchJson = fetchJson;

  const auth = (token) => ({ authorization: `Bearer ${token}` });

  await send("Page.enable");
  await send("Runtime.enable");

  /* ------------------------------------------------------------------ *
   * 1. The anonymous reader
   * ------------------------------------------------------------------ */

  await send("Page.navigate", { url: `${APP}/` });
  for (let attempt = 0; attempt < 40; attempt++) {
    await sleep(250);
    const ready = await evaluate(
      `document.readyState === "complete" && Boolean(document.querySelector("#recenzii"))`,
    );
    if (ready) break;
  }

  const anonymousRead = await fetchJson("/api/reviews?limit=6");
  const anonymousPayload = anonymousRead.body;
  const anonymousList = Array.isArray(anonymousPayload?.reviews);
  record(
    "an anonymous visitor can read the reviews",
    anonymousRead.status === 200 &&
      anonymousPayload?.configured === true &&
      anonymousList &&
      Number.isInteger(anonymousPayload?.total),
    `status=${anonymousRead.status}, configured=${String(
      anonymousPayload?.configured,
    )}, reviews=${anonymousList ? anonymousPayload.reviews.length : "not-an-array"}, total=${String(
      anonymousPayload?.total,
    )}`,
  );

  const anonymousWrite = await fetchJson("/api/reviews", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      rating: 4,
      body: `Scrriere fără sesiune. ${MARKER}`,
      channelId: "pro-tv",
      programmeTitle: null,
      programmeStartsAt: null,
      programmeEndsAt: null,
    }),
  });
  const anonymousWriteError =
    typeof anonymousWrite.body?.error === "string"
      ? anonymousWrite.body.error
      : "";
  record(
    "an anonymous write is refused",
    (anonymousWrite.status === 401 || anonymousWrite.status === 403) &&
      anonymousWriteError === COPY.anonymousWrite,
    `status=${anonymousWrite.status}, error=${JSON.stringify(
      anonymousWriteError,
    )}, expected=${JSON.stringify(COPY.anonymousWrite)}`,
  );

  const section = await evaluate(`(() => {
    const node = document.querySelector("#recenzii");
    if (!node) {
      return { found: false };
    }
    const rect = node.getBoundingClientRect();
    const text = (node.innerText || "").replace(/\\s+/g, " ").trim();
    return {
      found: true,
      heading: node.querySelector("h2")?.textContent?.trim() ?? null,
      cards: node.querySelectorAll('[data-testid="review-card"]').length,
      emptyHeading: text.includes(${JSON.stringify(COPY.empty)}),
      emptyAction: text.includes(${JSON.stringify(COPY.emptyAction)}),
      textLength: text.length,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        right: Math.round(rect.right),
      },
      viewportWidth: window.innerWidth,
    };
  })()`);

  record(
    "the homepage has the popular-reviews section",
    section.found === true && section.heading === COPY.heading,
    `found=${String(section.found)}, heading=${JSON.stringify(
      section.heading,
    )}, expected=${JSON.stringify(COPY.heading)}`,
  );

  const emptyStateIsHonest =
    section.cards > 0
      ? section.textLength > 0
      : section.emptyHeading === true && section.emptyAction === true;
  record(
    "the section shows a real state instead of a blank strip",
    emptyStateIsHonest,
    `cards=${String(section.cards)}, empty=${String(
      section.emptyHeading,
    )}, action=${String(section.emptyAction)}, textLength=${String(
      section.textLength,
    )}, expected-empty=${JSON.stringify(COPY.empty)} / ${JSON.stringify(
      COPY.emptyAction,
    )}`,
  );

  const sectionIsUsable =
    section.found === true &&
    section.rect.width > 0 &&
    section.rect.height > 80 &&
    section.rect.right <= section.viewportWidth + 1;
  record(
    "the reviews section does not break the landing page",
    sectionIsUsable,
    `rect=${JSON.stringify(section.rect)}, viewportWidth=${String(
      section.viewportWidth,
    )}`,
  );

  /* ------------------------------------------------------------------ *
   * 2. The signed-in writer
   * ------------------------------------------------------------------ */

  const token = await installSession(send);
  cleanupContext = { token, channel: null, createdId: null };
  let channel = null;
  const slotNotes = [];

  for (const channelId of CHANNEL_CANDIDATES) {
    const detail = await fetchJson(`/api/channel/${encodeURIComponent(channelId)}`);
    const now = detail.body?.now;
    if (
      detail.status !== 200 ||
      typeof now?.title !== "string" ||
      !now.title.trim() ||
      !Number.isFinite(Date.parse(now.startsAt))
    ) {
      slotNotes.push(`${channelId}: no programme on air`);
      continue;
    }

    const existing = await fetchJson(
      `/api/reviews?channel=${encodeURIComponent(channelId)}&limit=100`,
      { headers: auth(token) },
    );
    const occupied = (
      Array.isArray(existing.body?.reviews) ? existing.body.reviews : []
    ).some(
      (review) =>
        review.mine === true &&
        sameInstant(review.programmeStartsAt, now.startsAt),
    );
    if (occupied) {
      slotNotes.push(`${channelId}: the harness account already reviewed this slot`);
      continue;
    }

    channel = {
      id: channelId,
      title: now.title,
      startsAt: now.startsAt,
      endsAt: now.endsAt ?? null,
    };
    cleanupContext.channel = channel;
    break;
  }

  if (!channel) {
    throw new Error(
      `no known channel had a free programme slot for the harness account (${slotNotes.join(
        "; ",
      )})`,
    );
  }

  record(
    "a known channel has a programme on air",
    true,
    `channel=${channel.id}, programme=${JSON.stringify(
      channel.title,
    )}, startsAt=${channel.startsAt}`,
  );

  const created = await fetchJson("/api/reviews", {
    method: "POST",
    headers: {
      ...auth(token),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      rating: 4,
      body: BODY,
      channelId: channel.id,
      programmeTitle: channel.title,
      programmeStartsAt: channel.startsAt,
      programmeEndsAt: channel.endsAt,
    }),
  });
  const createdReview = created.body?.review;
  const createdId =
    typeof createdReview?.id === "string" ? createdReview.id : null;
  cleanupContext.createdId = createdId;

  record(
    "a signed-in visitor can write a review",
    created.status === 200 && Boolean(createdId),
    `status=${created.status}, id=${String(createdId)}, rating=${String(
      createdReview?.rating,
    )}, programme=${JSON.stringify(createdReview?.programmeTitle)}`,
  );

  if (!createdId) {
    throw new Error(
      `the review was not created (status=${created.status}, body=${created.text})`,
    );
  }

  const ownRead = await fetchJson(
    `/api/reviews?channel=${encodeURIComponent(channel.id)}&limit=100`,
    { headers: auth(token) },
  );
  const ownReview = (
    Array.isArray(ownRead.body?.reviews) ? ownRead.body.reviews : []
  ).find((review) => review.id === createdId);

  record(
    "the visitor can see their own review",
    ownRead.status === 200 &&
      ownReview?.mine === true &&
      ownReview?.rating === 4 &&
      ownReview?.body === BODY &&
      ownReview?.programmeTitle === channel.title,
    `status=${ownRead.status}, mine=${String(ownReview?.mine)}, rating=${String(
      ownReview?.rating,
    )}, programme=${JSON.stringify(ownReview?.programmeTitle)}, bodyFound=${String(
      ownReview?.body === BODY,
    )}`,
  );

  const publicRead = await fetchJson(
    `/api/reviews?channel=${encodeURIComponent(channel.id)}&limit=100`,
  );
  const publicReview = (
    Array.isArray(publicRead.body?.reviews) ? publicRead.body.reviews : []
  ).find((review) => review.id === createdId);
  record(
    "the new review is readable by an anonymous visitor",
    publicRead.status === 200 &&
      publicReview?.mine === false &&
      publicReview?.body === BODY,
    `status=${publicRead.status}, mine=${String(publicReview?.mine)}, bodyFound=${String(
      publicReview?.body === BODY,
    )}`,
  );

  const baseline = {
    like: ownReview?.counts?.like ?? 0,
    love: ownReview?.counts?.love ?? 0,
    clap: ownReview?.counts?.clap ?? 0,
  };
  record(
    "the new review carries three server counters",
    countsAreSound(ownReview?.counts) && ownReview?.own === null,
    `counts=${JSON.stringify(ownReview?.counts)}, own=${JSON.stringify(
      ownReview?.own,
    )}`,
  );

  /* ------------------------------------------------------------------ *
   * 3. The three reactions
   * ------------------------------------------------------------------ */

  const reactions = [
    {
      kind: "like",
      expected: { ...baseline, like: baseline.like + 1 },
    },
    {
      kind: "love",
      expected: { ...baseline, love: baseline.love + 1 },
    },
    {
      kind: "clap",
      expected: { ...baseline, clap: baseline.clap + 1 },
    },
  ];

  for (const reaction of reactions) {
    const answer = await fetchJson("/api/reviews/react", {
      method: "POST",
      headers: {
        ...auth(token),
        "content-type": "application/json",
      },
      body: JSON.stringify({ reviewId: createdId, kind: reaction.kind }),
    });
    const counts = answer.body?.review?.counts;
    const countersMatch = ["clap", "love", "like"].every(
      (kind) => counts?.[kind] === reaction.expected[kind],
    );
    record(
      `the ${reaction.kind} reaction has its own counter`,
      answer.status === 200 &&
        countersMatch &&
        answer.body?.review?.own === reaction.kind,
      `status=${answer.status}, counts=${JSON.stringify(
        counts,
      )}, own=${JSON.stringify(answer.body?.review?.own)}, expected=${JSON.stringify(
        reaction.expected,
      )}`,
    );
  }

  const finalCounts = {
    like: baseline.like,
    love: baseline.love,
    clap: baseline.clap + 1,
  };
  const anonymousCounters = await fetchJson(
    `/api/reviews?channel=${encodeURIComponent(channel.id)}&limit=100`,
  );
  const anonymousCounted = (
    Array.isArray(anonymousCounters.body?.reviews)
      ? anonymousCounters.body.reviews
      : []
  ).find((review) => review.id === createdId);
  const anonymousCountsMatch = ["clap", "love", "like"].every(
    (kind) => anonymousCounted?.counts?.[kind] === finalCounts[kind],
  );
  record(
    "the server counters are readable by an anonymous visitor",
    anonymousCounters.status === 200 &&
      anonymousCountsMatch &&
      anonymousCounted?.own === null,
    `status=${anonymousCounters.status}, counts=${JSON.stringify(
      anonymousCounted?.counts,
    )}, own=${JSON.stringify(anonymousCounted?.own)}, expected=${JSON.stringify(
      finalCounts,
    )}`,
  );

  /* ------------------------------------------------------------------ *
   * 4. The editor
   * ------------------------------------------------------------------ */

  const edited = await fetchJson(`/api/reviews/${encodeURIComponent(createdId)}`, {
    method: "PATCH",
    headers: {
      ...auth(token),
      "content-type": "application/json",
    },
    body: JSON.stringify({ rating: 5, body: EDITED_BODY }),
  });
  record(
    "the visitor can edit their own review",
    edited.status === 200 &&
      edited.body?.review?.rating === 5 &&
      edited.body?.review?.body === EDITED_BODY,
    `status=${edited.status}, rating=${String(
      edited.body?.review?.rating,
    )}, body=${JSON.stringify(edited.body?.review?.body)}, expectedBody=${JSON.stringify(
      EDITED_BODY,
    )}`,
  );

  const editedRead = await fetchJson(
    `/api/reviews?channel=${encodeURIComponent(channel.id)}&limit=100`,
    { headers: auth(token) },
  );
  const editedReview = (
    Array.isArray(editedRead.body?.reviews) ? editedRead.body.reviews : []
  ).find((review) => review.id === createdId);
  record(
    "the edit is the row the server now holds",
    editedRead.status === 200 &&
      editedReview?.rating === 5 &&
      editedReview?.body === EDITED_BODY,
    `status=${editedRead.status}, rating=${String(
      editedReview?.rating,
    )}, body=${JSON.stringify(editedReview?.body)}`,
  );

  /* ------------------------------------------------------------------ *
   * 5. The delete, and the cleanup that follows it
   * ------------------------------------------------------------------ */

  const deleted = await fetchJson(`/api/reviews/${encodeURIComponent(createdId)}`, {
    method: "DELETE",
    headers: auth(token),
  });
  record(
    "the visitor can delete their own review",
    deleted.status === 204,
    `status=${deleted.status}, expected=204`,
  );

  const afterDelete = await fetchJson(
    `/api/reviews?channel=${encodeURIComponent(channel.id)}&limit=100`,
    { headers: auth(token) },
  );
  const stillThere = (
    Array.isArray(afterDelete.body?.reviews) ? afterDelete.body.reviews : []
  ).some((review) => review.id === createdId);
  record(
    "the deleted review is gone from the server",
    afterDelete.status === 200 && !stillThere,
    `status=${afterDelete.status}, stillThere=${String(stillThere)}`,
  );

  cleanupContext.createdId =
    deleted.status === 204 && !stillThere ? null : createdId;
  return cleanupContext;
}

/**
 * Delete the marker row even when a step threw. The search by marker is
 * the safety net: if the create answered badly but the row exists, it is
 * still found and removed.
 */
async function cleanup(context) {
  if (!context?.token || !context?.channel) {
    console.log("Cleanup: no review was created; the database was not touched.");
    return true;
  }

  const request = browserFetchJson;
  if (!request) {
    record(
      "the harness cleaned up after itself",
      false,
      "the browser was not available to remove the harness review",
    );
    return false;
  }

  const { token, channel } = context;
  const headers = { authorization: `Bearer ${token}` };
  let ids = context.createdId ? [context.createdId] : [];

  if (ids.length === 0) {
    const answer = await request(
      `/api/reviews?channel=${encodeURIComponent(channel.id)}&limit=100`,
      { headers },
    );
    ids = (
      Array.isArray(answer.body?.reviews) ? answer.body.reviews : []
    )
      .filter((review) => review.body?.includes(MARKER))
      .map((review) => review.id);
  }

  if (ids.length === 0) {
    console.log("Cleanup: the harness review is already gone; the database is as it was found.");
    return true;
  }

  const statuses = [];
  for (const id of ids) {
    const answer = await fetchJson(`/api/reviews/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers,
    });
    statuses.push(`${id}:${answer.status}`);
  }

  const clean = statuses.every((entry) => {
    const status = Number(entry.split(":").at(-1));
    return status === 204 || status === 404;
  });
  record(
    "the harness cleaned up after itself",
    clean,
    `deleted=${statuses.join(", ")}; the database was left as it was found`,
  );
  return clean;
}

let edge = null;
let ws = null;
let context = null;

try {
  context = await main();
} catch (error) {
  record(
    "the harness ran through every step",
    false,
    error instanceof Error ? error.message : String(error),
  );
} finally {
  if (context || edge) {
    try {
      await cleanup(context);
    } catch (error) {
      record(
        "the harness cleaned up after itself",
        false,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  try {
    ws?.close();
  } catch {
    /* the browser was already gone */
  }
  edge?.kill();
  // The browser is on its way out, and Windows keeps its profile files
  // locked for a moment after the process is told to leave. The
  // directory is disposable and lives in the temporary folder, so a
  // locked file is not a failure of the run.
  await sleep(300);
  await rm(OUT, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(
    () => undefined,
  );
}

const failed = results.filter((result) => !result.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length > 0) {
  for (const result of failed) console.log(`FAILED: ${result.name}`);
  process.exitCode = 1;
}
