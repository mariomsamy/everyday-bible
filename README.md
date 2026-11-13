# Everyday Bible (الكتاب المقدس)

Installable, offline-first Bible reader with reading plans, progress tracking, social sharing and an
analytics/pixel backend. **No registration and no personal data.**

- **Frontend** `app/` — React + TypeScript + Vite. Arabic/English UI with RTL, a catalog of 141 Bible versions (Arabic default), reading plan, progress, verse image cards.
- **Backend** `server/` — zero-dependency Node (>= 22.5): serves the PWA, stores anonymous events in SQLite, serves pixel IDs,
  shared-verse link previews, and an admin dashboard at `/admin`.
- **Bible texts** — versions are listed in `app/src/data/catalog.json`, downloaded once per device through jsDelivr and then stored offline.

## Run

```bash
cd app && npm ci && npm run build && cd ..
ADMIN_TOKEN='<long random string>' PORT=8080 npm start     # http://127.0.0.1:8080  and  /admin
```

Tests: `npm test` (server) and
`cd app && node --test src/progress/` (plan maths).

## Deploy on any server

Pick one. All need HTTPS in front for the PWA to install (see `deploy/Caddyfile` or `deploy/nginx.conf`).

**Docker (any host with Docker)**
```bash
cp .env.example .env     # set ADMIN_TOKEN (16+ chars), PUBLIC_URL=https://your-domain, TRUST_PROXY=1
docker compose up -d --build
```
Data (SQLite, Bible texts, admin settings) persists in the `bible-data` volume. On first start it downloads the texts listed in `FETCH_TEXTS` in the background (default `all`: every version, about 670 MB; use e.g. `ar_kehm,en_web,en_kjv` for a few). Optional build arg: `VITE_CONTACT_EMAIL` for the privacy policy. Health check: `/healthz`.

**Without Docker (Node >= 22.5)**
```bash
bash deploy/install.sh --texts     # builds the app, creates .env with a random admin token, downloads texts
npm start                          # or: deploy/bible.service for systemd
```

After it is up: open `/admin`, sign in with `ADMIN_TOKEN`, and set pixels and the AI assistant there. Back up `DB_PATH` and `TEXTS_DIR` (or the Docker volume).

## Production checklist

- [ ] `ADMIN_TOKEN` set (16+ random chars); `PUBLIC_URL=https://your-domain`; `TRUST_PROXY=1` only behind exactly one proxy; HTTPS in front.
- [ ] Bible texts self-hosted (`FETCH_TEXTS=all` in Docker, or `npm run texts`) and `CDN_FALLBACK=0`, so no visitor IP reaches a third-party CDN.
- [ ] `VITE_CONTACT_EMAIL` set at build time (privacy policy contact).
- [ ] Each Bible version's licence checked; remove what you may not distribute from `app/src/data/catalog.json`.
- [ ] AI assistant: configure in `/admin` (vendor, model, key, limits), press **Test connection**; the privacy policy already discloses it.
- [ ] Pixels (if used): only after visitors opt in; set in `/admin`.
- [ ] Back up the data volume (SQLite + texts); run `npm audit` in `app/` and an external scanner before launch.
- The daily devotional is off until content packs exist in `app/public/devotional/<lang>.json` (build with `VITE_DEVOTIONAL=1`).

## Configuration (environment)

| Variable | Purpose |
|---|---|
| `ADMIN_TOKEN` | Required for `/admin`, at least 16 characters. Without it the dashboard is disabled (fails closed). Sent as a Bearer header, never in the URL. |
| `META_PIXEL_ID`, `TIKTOK_PIXEL_ID`, `SNAP_PIXEL_ID`, `GA4_ID` | Third-party pixels. Loaded in a browser **only** after that person opts in to "advertising pixels". The CSP only allows the domains of pixels you configure. |
| *(admin page)* | Pixels (Meta, TikTok, Snapchat, GA4), statistics on/off and retention, and the **AI assistant** (vendor: Anthropic, OpenAI, Gemini, OpenRouter or any OpenAI-compatible endpoint; model; API key; per-minute, per-day and global daily limits; extra instructions) are edited at `/admin` and apply immediately. The AI is **off** until you enable it and save a key; the key is stored encrypted (derived from `ADMIN_TOKEN`, so changing the token means entering it again), never sent to browsers. Visitors' questions and the verse shown go to the vendor you pick: say so in your privacy policy. |
| `TEXTS_DIR` | Folder of self-hosted Bible texts (default `server/texts`; fill it with `node scripts/fetch-texts.mjs`). |
| `PORT`, `HOST` | Listen address (default `127.0.0.1:8080`). |
| `DB_PATH` | SQLite file (default `server/data.sqlite`). Back it up and include it in your retention policy. |
| `TRUST_PROXY=1` | Only if behind exactly one reverse proxy; then the last `X-Forwarded-For` hop is used for rate limiting. |
| `PUBLIC_URL` | Public origin used in link-preview tags, e.g. `https://bible.example.com`. |
| `VITE_CONTACT_EMAIL` | (build time) contact address printed in the privacy policy. |

Serve over HTTPS in production (PWA install and service worker require it) — put Caddy/nginx in front.

## Features

Reading plan with a duration you choose (30 days … any number), scoped to the whole Bible / 66 books / OT / NT, balanced by
verse count, with today's reading, catch-up re-planning and projected finish · progress screen (streak, 30-day chart, per-book
bars) · mark chapters read · share verses as text, link, or a generated image (native share sheet, WhatsApp, Telegram, X,
Facebook, download) (links open the verse in the app) · 141 versions in 85 languages (Arabic default: Ketab El Hayat) ·
highlights, notes, search, compare, listen · backup/restore of progress and plan.

## Privacy design (Egypt PDPL / KSA / UAE oriented)

- Progress and plan live **only on the device** (localStorage). The server never receives the list of chapters read.
- Statistics and pixels are **off by default**, asked once after the intro, each separately, and only after the person confirms
  they are 18+ (or have a guardian's permission). Settings can withdraw consent and **delete all data already sent**.
- Events carry a random per-device id, the book id (not chapter), counts, share channel. No IP, user agent, verse text or notes
  are stored. Events older than 400 days are purged automatically.
- Fonts and scripts are self-hosted. Third-party requests: the Bible-text download (jsDelivr, disclosed in the policy) and the pixels the person opted in to. While pixels are on, the address bar stays at the site root so third parties never see the book/chapter.

## Before you launch

1. **Check each Bible version's licence.** The catalog lists many modern copyrighted translations (e.g. the default Arabic `ar_kehm`); keep only the ones you may distribute in `app/src/data/catalog.json`.
2. Set a real contact in `VITE_CONTACT_EMAIL` and have the privacy policy / terms (in `app/src/privacy.ts`, `terms.ts`) reviewed.
3. Marketing messages, payments and uploads are not present, so those MENA checklist items are N/A.
4. Run an external scanner and `npm audit` in `app/` before going live.

Credits: Noto Naskh Arabic (SIL OFL 1.1). Source licence: see `app/LICENSE`.
