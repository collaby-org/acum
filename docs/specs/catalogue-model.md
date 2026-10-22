# Spec — the catalogue model

Status: accepted · Version line: `package.json` · Owner: integrator

## The problem

`cool-etv.net` lists the same broadcast channel once per upstream feed. A
viewer sees "Antena 1 S1", "Antena 1 S2 HD", "Antena 1 S3", "Antena 1 S4" in
the mega-menu and reasonably concludes the site carries four channels.

The first version of ACUM copied that shape literally: 203 catalogue
entries, most of them the same channel with a different suffix. Two things
broke.

1. **Navigation.** A visitor looking for "Antena 1" had to pick the right one
   of four near-identical entries, and could not tell which of them worked.
2. **Resilience.** When one feed of a channel went down there was nothing to
   fall back to, because the alternative feed was a different catalogue entry
   with a different name.

The user's words: *"we have on many S1, S2, S3, those are servers and we must
use one that works and if that is down use other as fallback."*

## The decision

**One `Channel` per real broadcast channel. Every upstream feed is a
`Server` of that channel, and the player walks the server list.**

```ts
type Channel = {
  id: string;          // "antena-1"
  name: string;        // "Antena 1"
  family: string;      // "Antena 1"
  familyKey: string;   // "Ant 1"
  category: CategoryId;
  logo: string | null;
  logoRemote: string | null;
  status: ServerStatus;   // best status across the servers
  servers: Server[];      // best first
};

type Server = {
  id: string;          // "an1"
  label: string;       // "S1"
  embedUrl: string | null;
  sourcePage: string;
  status: ServerStatus;
  kind: "iframe" | "acestream" | "none";
  hlsUrl: string | null;   // a directly playable HLS playlist, when resolved
};
```

The contract lives in `src/data/types.ts`. It is the file every layer
imports; nothing redeclares these shapes.

## Grouping rules

Feeds are grouped into one channel when they are the same broadcast:

| Family | Feeds | Channel |
| ------ | ----- | ------- |
| `Ant 1` | `an1`, `an1-s2` | Antena 1 |
| `Caln D 1&2` | `cd-s1`, `cd-s2` | Kanal D |
| `Caln D 1&2` | `cd-s3`, `cd-s4` | Kanal D 2 |
| `HB0 R0` | `hro1-s1`, `hro1-s2` | HBO |
| `HB0 R0` | `hro2-s1`, `hro2-s2` | HBO 2 |
| `TVR 's` | `tvr1`, `tvr1-s2` | TVR 1 |
| `TVR 's` | `tvr2`, `tvr2-s2` | TVR 2 |

But feeds stay separate when they are genuinely different channels:
`TVR 1` and `TVR 2` are different channels; `HBO` and `HBO 2` are different
channels; `LOOK Sport 1` through `LOOK Sport 5` are different channels.

The grouping lives in `scripts/channel-taxonomy.json` — the hand-written
editorial layer. Every one of the 203 source feed slugs appears exactly once
across the file.

## Server ordering

The player tries servers in this order:

1. a server with a resolved `hlsUrl` — it plays directly, with our own
   player, no upstream chrome, no ads, instant start;
2. a server whose embed was verified to serve a player;
3. everything else, alphabetically, so the order is stable.

## Consequences

- The catalogue drops from 203 entries to the number of real channels, and
  every entry is a channel a person would recognise.
- A channel with four feeds shows four working chances to play.
- The card can show "S1 · S2" so the fallback is visible before the user
  clicks.
- A channel with a single dead feed is no longer a dead entry — it falls
  back.

## What it does not do

- The catalogue is still a snapshot of `cool-etv.net`. It is not a live feed.
- AceStream feeds stay in the catalogue, labelled, because dropping them
  would hide real channels.
