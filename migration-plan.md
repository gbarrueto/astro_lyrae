# AST Booking → Astro Migration Plan

**Status:** Not started. This document is the single source of context for whoever (human or Claude instance) picks up this migration in a fresh workspace — it does not assume access to the original repo's conversation history.

**How this migration will be worked:** Manually, on purpose. The person doing this wants the practice. Claude's role here should be **reviewing, explaining, and unblocking** — answering "why does this hydration directive not work" or "is this the right place for this fetch" — not writing the Astro pages/components wholesale. Only write code directly if explicitly asked to.

---

## 1. Why migrate (recap of findings)

The current site (`ast_booking`) is a Vite + React 18 SPA: a mostly-static Spanish-language astrotourism showcase (landing sections: Intro, ServiceSlideshow, GoodToKnow, Contact) plus two genuinely interactive pieces — a `Navbar` that polls a weather/seeing API every 30 min, and a `Seeing` section where the user picks an observation hour and fetches conditions for it. A `/service/:id` detail route renders per-service info computed from the current date (season).

Almost none of this needs to be a client-side React app. Astro's islands architecture fits: ship static HTML for everything, hydrate only the two components that actually hold state and fetch data.

**Gains:**
- Near-zero shipped JS for Intro/ServiceSlideshow/GoodToKnow/Contact/ServiceDetail — these become plain `.astro` templates.
- File-based routing replaces the hand-rolled `react-router-dom` `<Routes>` in `App.jsx`.
- Per-service season/target logic (currently computed client-side in `ServiceDetail.jsx` on every render) can move to page frontmatter and run at build/request time instead.
- Better default SEO/perf since content is server-rendered by default.

**Losses / trade-offs:**
- Two-layer mental model: `.astro` files (structure, server-side data prep) vs `.jsx` islands (anything stateful), each hydrated explicitly via `client:load` / `client:visible` / `client:idle` / `client:only="react"`. This is the main new concept to internalize.
- Global state shared *across* islands doesn't work like normal React context — needs a cross-island store (nanostores) if the islands ever need to talk to each other.
- One more build tool/config surface (`astro.config.mjs`) alongside the existing Vite mental model — though Astro is Vite-based under the hood, so the `@/` alias and general dev-server feel carry over.

---

## 2. Current codebase snapshot (as of migration start)

Frontend (`src/`):
- `src/pages/index.jsx` — mounts `App.jsx` into `#root` (from `index.html`).
- `src/App.jsx` — `BrowserRouter` + `Routes`: `/` → `Home`, `/service/:id` → `ServiceDetail`. Renders `Navbar` outside `<Routes>` (persistent across pages).
- `src/pages/Home.jsx` — sequences `Intro`, `ServiceSlideshow`, `GoodToKnow`, `Seeing`, `Contact` from `src/components/Index/`.
- `src/pages/ServiceDetail.jsx` — keyed by `:id` (`observacion-visual`, `eaa`, `fotografia-nocturna`). Computes southern-hemisphere season from `new Date().getMonth()` and picks seasonal/variable observation targets per service, all inline in the component. No shared/global data file for this — it's local to the component today.
- `src/components/Navbar/navbar.jsx` — **stateful/interactive island candidate**. Live clock (`setInterval`, 1s), polls `/api/weather` every 30 min, renders weather icon + seeing value + a click-to-open modal explaining seeing quality.
- `src/components/Index/Seeing.jsx` — **stateful/interactive island candidate**. Hour-picker (21:00–02:00 observable hours), fetches `/api/weather?hour=N` on click, renders loading/error/advice states.
- `src/components/Index/{Intro,ServiceSlideshow,GoodToKnow,Contact}.jsx` — presentational, no state beyond maybe simple carousel logic in `ServiceSlideshow` — check before assuming fully static, but no data fetching.
- Path alias `@/` → `src/`, configured in `vite.config.js` and `jsconfig.json`. Keep this alias in the Astro config.

Backend (`api/`) — **not touched by this migration**, see §5:
- `api/weather.js` — Vercel serverless function.
- `api/dev-server.js` — Express server for local dev (`yarn dev:api`, port 3001), duplicates `weather.js`'s scraping logic on purpose (different runtime entry points).
- Both scrape Meteoblue's seeing-forecast widget HTML via `cheerio` for the Quillaileo coordinates; Santiago local time computed manually as `(utcHour - 3 + 24) % 24` (no DST). Response shape: `{ success, timestamp, currentHour, requestedHour, moonPhase, currentHourData: { hour, temp, humidity, clouds, seeing } }`. Falls back to the closest available hour if the exact one isn't in the scraped table. Full details in `API.md` in the original repo.

Deployment — **two configs currently coexist and disagree**:
- `vercel.json` (Vite preset) implies `api/weather.js` runs as a Vercel function.
- `.github/workflows/node.js.yml` actually deploys `dist/` to **Netlify** on push to `main` — Netlify serves static output only, so `/api/weather` does not exist in that deployed target today. This mismatch predates the Astro migration and should be resolved (or at least consciously decided) independently of it — see §6.

No test suite exists. ESLint flat config (`eslint.config.js`) with React/hooks/refresh plugins — will need an Astro-aware update (see §4 step 1).

---

## 3. Target architecture

```
src/
  layouts/
    BaseLayout.astro        # <html>, <head>, Navbar island, global CSS imports
  pages/
    index.astro             # was Home.jsx — sequences static sections + Seeing island
    service/[id].astro      # was ServiceDetail.jsx — dynamic route, data prepped in frontmatter
  components/
    Intro.astro             # static, no directive
    ServiceSlideshow.astro  # static unless it needs client JS for the carousel — check current impl first
    GoodToKnow.astro        # static
    Contact.astro           # static
    islands/
      Navbar.jsx            # client:load (needs to be interactive immediately, live clock)
      Seeing.jsx            # client:visible (below the fold, fine to hydrate lazily)
  lib/
    services.js             # per-service static data + season/target logic, imported by service/[id].astro frontmatter (pulled OUT of the component, unlike today)
  stores/
    (only if/when islands need to share state — nanostores atoms live here)
```

Key naming note: today `src/pages/index.jsx` is the *app entry point* (mounts React), not a route. In Astro, `src/pages/*.astro` files ARE routes. Don't recreate the old `pages/index.jsx` — the entry-point concept goes away entirely; Astro handles bootstrapping.

---

## 4. Migration steps

Work through these roughly in order. Each step is meant to be done by hand — treat the notes as "what to verify/decide," not a script to paste.

### Step 0 — scaffold
- `npm create astro@latest` (or into this repo directly, decide fresh project vs. in-place — recommend fresh `astro/` sibling dir first, then move things over, so `yarn dev` on the old app keeps working as a reference until cutover).
- `astro add react` — installs `@astrojs/react` and wires `astro.config.mjs`.
- `astro add tailwind` if going with shadcn (shadcn assumes Tailwind).
- Port the `@/ → src/` alias into `astro.config.mjs` (`vite.resolve.alias`) and `tsconfig.json`/`jsconfig.json`.

### Step 1 — static sections first
- Convert `Intro.jsx`, `GoodToKnow.jsx`, `Contact.jsx` to `.astro` components. These have no client state — this is the easiest way to get a feel for `.astro` syntax (frontmatter fence `---` + HTML template, no JSX return needed).
- Check `ServiceSlideshow.jsx` for any state/refs (carousel logic) before assuming it's static — if it only auto-advances via CSS or a simple interval with no user interaction requirements, decide whether to keep it JS-free (CSS animation) or make it a small island.
- Build `src/layouts/BaseLayout.astro` — move `index.html`'s `<head>` (title "Lyrae Astronomía", viewport meta, favicon) here, plus global CSS imports (`index.css`, `App.css`).

### Step 2 — routing
- `src/pages/index.astro` uses `BaseLayout` and renders the static sections + the `Seeing` island in order (Intro → ServiceSlideshow → GoodToKnow → Seeing → Contact) — same order as today's `Home.jsx`.
- `src/pages/service/[id].astro` replaces `ServiceDetail.jsx` + `react-router-dom`'s `:id` param — Astro exposes it via `Astro.params.id` in frontmatter. Move `service_info`, `seasonal_targets`, and the season calculation out of the component into `src/lib/services.js` (plain functions/data, importable from frontmatter) — this was already awkwardly duplicated inline in the original component; migration is a good time to give it a real home.
- Not-found service case: use Astro's `404` handling or a simple guard in the page that redirects/renders a "not found" block — check current Astro version's recommended pattern for dynamic-route 404s before implementing.

### Step 3 — the two islands
- `Navbar.jsx`: keep as a React component, near-verbatim port of the existing logic (live clock interval, weather poll, modal). Mount it in `BaseLayout.astro` with `client:load` — it needs to be interactive on first paint (clock ticking immediately), so lazy hydration directives aren't appropriate here.
- `Seeing.jsx`: port similarly, mount with `client:visible` in `index.astro` — it's a below-the-fold section, no reason to hydrate before the user scrolls to it.
- **Verify hydration boundaries carefully**: anything passed as props from `.astro` to these islands must be serializable (no functions/class instances) — shouldn't be an issue here since both fetch their own data client-side, but keep in mind if any static data starts getting passed in as props later.

### Step 4 — shadcn/ui (optional, only if adopting it for new UI work)
- Prereq: Tailwind installed (Step 0).
- Run the shadcn CLI targeting a React components directory (e.g. `src/components/ui/`) same as any React+Tailwind project — Astro's React integration doesn't change shadcn's own setup.
- Presentational shadcn components (Card, Badge, Separator, etc.) can be imported directly into `.astro` files and rendered **with no hydration directive** — they're just React components with no client-side interactivity, so Astro server-renders them to static HTML and ships zero JS for them.
- Only components with actual interactivity (Dialog, DropdownMenu, form controls with client validation) need a `client:*` directive, and at that point they behave like any other island — same rules as Step 3.

### Step 5 — state management (only if/when needed)
- Don't add anything preemptively — today `Navbar` and `Seeing` don't share state.
- If a future feature needs the two islands (or an island + an `.astro` page) to share state, reach for **nanostores** (`nanostores` + `@nanostores/react`): a small atom defined once in `src/stores/`, imported and read/written from any island regardless of framework. This is the Astro-recommended pattern specifically because normal React context doesn't cross island boundaries (each hydrated island is its own isolated React root).

### Step 6 — data fetching with TanStack Query (optional upgrade, not required for parity)
- Only relevant inside the React islands (`Navbar`, `Seeing`) — `.astro` frontmatter fetching (for anything static/build-time) doesn't need or benefit from TanStack Query.
- Each hydrated island is its own React root, so `QueryClientProvider` must wrap each island that uses `useQuery` individually (or wrap a single shared parent island if both end up composed together — decide this once you see whether Navbar/Seeing end up sharing a mount point).
- This is a good opportunity to replace the current manual `loading`/`error`/`useEffect` state juggling in both components with `useQuery`, and to dedupe the 30-min poll interval via `refetchInterval` instead of a hand-rolled `setInterval`.

### Step 7 — cutover
- Point `yarn dev` at the new Astro project; keep the old Vite+React app around (different branch or directory) until the new one has visual/functional parity — compare side by side rather than deleting early.
- Update the deploy workflow (`.github/workflows/node.js.yml`) — Astro's build output path and `astro build` command differ from `vite build`; also decide the Vercel-vs-Netlify question (§6) before finalizing this, since it affects whether `/api/weather` needs an Astro-native endpoint (`src/pages/api/weather.js`, Astro's own API routes) or stays a separate Vercel function untouched.

---

## 5. The Node/Express backend — unaffected by this migration

`api/weather.js` and `api/dev-server.js` do **not** need to change to support Astro. Astro doesn't replace or wrap your API layer:
- `api/weather.js` keeps deploying as a Vercel serverless function exactly as it does today, regardless of what generates the frontend.
- `api/dev-server.js` + `yarn dev:api` keep working standalone in a second terminal, same as today — Astro's dev server is just another Vite-based process alongside it, nothing about it interferes with Express.
- If you eventually want a single unified dev/deploy story, Astro *does* support its own API routes (`src/pages/api/*.js`, using the same file-based convention as pages) — that would let you fold `api/weather.js`'s logic into the Astro project itself and drop the separate Express dev server. This is optional and not required for the migration to succeed; treat it as a later simplification, not a blocker.

---

## 6. Deferred/open decisions (not part of this migration, tracked here so they aren't lost)

These came up during planning but are independent of the Astro rewrite — don't let them block it:

1. **Vercel vs. Netlify.** The repo currently has both a `vercel.json` and a Netlify-deploying GitHub Actions workflow, and only Vercel would actually serve `/api/weather` in production as configured today. Decide which platform is canonical before or shortly after the Astro cutover, since it determines whether Astro's own API routes (§5) are worth adopting to unify deployment.
2. **Seeing-data history / logging.** Currently every request to `/api/weather` just scrapes Meteoblue live and returns it — nothing is persisted. If historical seeing data is wanted (trend analysis, "how accurate was last night's forecast"), storage needs to survive serverless cold starts, which rules out a local SQLite file on Vercel. Candidates: **Turso** (serverless libSQL/SQLite, persists across invocations) or a hosted Postgres (Supabase/Neon). Not yet decided — revisit once the Astro migration is stable.
3. **Ephemerides** (moon phase, rise/set times, visible planets/objects for the night). Likely computable on-demand with a library such as `astronomy-engine` rather than stored/precomputed, since these are deterministic given date+location — but confirm this against whatever specific data points are wanted before assuming no storage is needed.

---

## 7. Things to double-check once in the new workspace (state may have drifted)

Since this plan was written from a snapshot of the original repo, verify before trusting any specific claim above:
- `ServiceSlideshow.jsx`'s actual carousel implementation (state/refs vs. pure CSS) — this determines whether it's a Step 1 static conversion or a Step 3 island.
- Current Astro version's recommended pattern for dynamic-route 404s (this changes across major versions).
- Whether `framer-motion` (currently an unused dependency in the original repo) is still unused, or got adopted for something — if unused, don't bother porting it into the Astro project's dependency list.
