# Getting Started: Astro, from scratch

You're rusty with web dev and doing this migration by hand on purpose. This doc is
your orientation — read it once before touching code, then use it as a reference.
My role from here is **review/explain/unblock only**: ask me "why doesn't this
work," "is this the right file for this," "does this match the plan" — I won't
write or edit the migration code unless you explicitly ask me to.

The other source of truth is [migration-plan.md](migration-plan.md) — that's the
*what and why* of this specific migration. This doc is the *how does Astro even
work* primer underneath it.

---

## 1. The mental shift, in one paragraph

React SPA: one JS bundle boots, mounts to `#root`, and *everything* — including
static text that never changes — becomes client-side JS that has to download,
parse, and run before the user sees content. Astro: pages are rendered to plain
HTML on the server/at build time by default, and **zero JS ships unless you
explicitly ask for it**. You opt individual components into becoming interactive
("islands"). Most of your old app (Intro, GoodToKnow, Contact, the service detail
page) doesn't need JS at all — it was only React because the whole app was React.
Only the weather-polling navbar and the hour-picker section actually need to run
code in the browser.

---

## 2. Anatomy of a `.astro` file

Open [src/pages/index.astro](src/pages/index.astro) — it's short, look at it now.
Every `.astro` file has two parts:

```astro
---
// "frontmatter": plain JS/TS, runs on the server, NEVER reaches the browser.
// imports, data fetching, computed variables — this is where
// ServiceDetail's season-calculation logic will move to.
import Welcome from '../components/Welcome.astro';
const foo = "bar";
---

<!-- template: HTML, plus {expression} interpolation and component tags -->
<Layout>
  <Welcome />
  <p>{foo}</p>
</Layout>
```

No `return`, no JSX. It's closer to an HTML template with a JS preamble than to a
React component. Key differences from JSX you'll trip on:
- `class` not `className`.
- Loops: `{items.map(item => <li>{item}</li>)}` — this part *is* JSX-like.
- Conditionals: `{condition && <p>shown</p>}` — same idea, works fine.
- `<style>` tags at the bottom of a `.astro` file are **scoped to that component
  automatically** — no CSS modules ceremony needed. Global CSS still needs a
  normal `import './foo.css'` in frontmatter.
- `.astro` components **cannot** hold client-side state or use hooks. If a
  component needs `useState`/`useEffect`, it has to be a `.jsx` file (a React
  "island" — see §4), not a `.astro` file.

## 3. File-based routing

`src/pages/*.astro` (or `.md`) files ARE routes — no `react-router-dom`, no
`<Routes>` config. `src/pages/index.astro` → `/`. `src/pages/about.astro` →
`/about`. Dynamic segments use brackets: `src/pages/service/[id].astro` → `/service/:id`,
and inside that file's frontmatter you read `Astro.params.id` instead of
`useParams()`. This directly replaces `App.jsx`'s router and `ServiceDetail.jsx`'s
`useParams` call.

## 4. Islands: the one genuinely new concept

A `.jsx` component dropped into a `.astro` file renders to static HTML **and ships
no JS** by default — same as any `.astro` component. To make it interactive you
add a `client:*` directive to the tag:

```astro
<Navbar client:load />       <!-- hydrate immediately on page load -->
<Seeing client:visible />    <!-- hydrate when it scrolls into view -->
<Foo client:idle />          <!-- hydrate when the browser is idle -->
<Foo client:only="react" />  <!-- skip server render entirely, client-render only -->
```

Each hydrated island is **its own isolated React root**. This matters because:
- Two islands on the same page can't share React Context or state the way two
  components in one SPA tree could — there's no shared tree. If two islands ever
  need to talk to each other, that's what §5 of the migration plan (nanostores)
  is for. Not needed yet — `Navbar` and `Seeing` are independent today.
- Props passed from `.astro` → island must be plain serializable data (strings,
  numbers, plain objects/arrays) — no functions, no class instances. They get
  serialized to a script tag and read back on the client.

**Picking a directive for a given component**: ask "does this need to be
interactive before the user does anything (clock ticking, poll starting), or can
it wait?" `Navbar` has a live clock that must start immediately → `client:load`.
`Seeing` is below the fold and only reacts to a click → `client:visible` is fine,
per the plan.

## 5. Images and assets

`src/assets/` (imported in frontmatter, e.g. `import bg from '../assets/bg.jpg'`)
gets processed/optimized by Astro's build pipeline. `public/` is served verbatim
at the same path (e.g. `public/favicon.svg` → `/favicon.svg`) — no processing, no
import, just reference the URL string directly. Prefer `src/assets/` for anything
that benefits from optimization (photos); `public/` for things like favicons that
must live at a fixed URL.

---

## 6. This repo's current state

Already done (Step 0, partially):
- Astro itself is installed (`astro ^7.0.7`), using **pnpm** (see
  `pnpm-lock.yaml`/`pnpm-workspace.yaml` — use `pnpm`, not `npm`/`yarn`, for
  anything in *this* repo).
- It's the stock `basics` starter template — [Welcome.astro](src/components/Welcome.astro)
  and [Layout.astro](src/layouts/Layout.astro) are placeholder scaffolding, not
  yours to keep. You'll replace `Welcome.astro`'s content and rename/rebuild
  `Layout.astro` into the plan's `BaseLayout.astro`.

Not yet done, and next in line per the plan's Step 0:
- `astro add react` — installs `@astrojs/react`, wires it into `astro.config.mjs`.
  This is a prerequisite for *any* island work (Navbar, Seeing).
- `astro add tailwind` — only if you're adopting shadcn/ui (plan's Step 4,
  optional). Skip it for now if you're not sure yet; easy to add later.
- Port the `@/ → src/` path alias from the old repo's `vite.config.js` /
  `jsconfig.json` into `astro.config.mjs` (`vite.resolve.alias`) and
  `tsconfig.json` (`compilerOptions.paths`). Small but easy to forget, and every
  old component imports assets/components via `@/...`.

The old app is right next door at `../ast_booking` (sibling directory) — that's
your reference implementation for every port. Nothing there needs to change; you're
only reading it.

## 7. One thing the plan flagged for you to verify — already checked

The plan (§7) said to double check whether `ServiceSlideshow.jsx` is really
static before assuming it's an easy Step-1 `.astro` conversion. I looked: it
has `useState` for the current slide and an `onClick` handler on each dot — it's
**stateful**, not static. So it doesn't belong in Step 1 with Intro/GoodToKnow/Contact;
it's a third island candidate (or you rebuild the same interaction with plain CSS/
a `<script>` tag, if you want zero JS for something this small — Astro supports
inline `<script>` tags in `.astro` files for tiny bits of vanilla JS, no framework
required). Worth deciding deliberately rather than defaulting to "island" — it's
just three dots and a text swap, which is well within reach of a few lines of
vanilla JS if you want the zero-JS win.

---

## 8. Dev workflow for this repo

Per `AGENTS.md`/`CLAUDE.md` (same file, symlinked) — start the dev server in the
background so it doesn't block your terminal:

```
astro dev --background
astro dev status
astro dev logs
astro dev stop
```

Default port is `4321`. `astro check` runs Astro's type checker (worth running
before you consider a step "done").

---

## 9. Suggested order of attack

Roughly the plan's own step order, but as a concrete checklist:

1. `astro add react`, then wire the `@/` alias (Step 0). Confirm with a throwaway
   `console.log` or a dummy component that the alias resolves before moving on.
2. Convert `Intro.jsx` → `Intro.astro` first — smallest, no state, good place to
   get a feel for frontmatter + template syntax. Then `GoodToKnow`, `Contact`.
3. Decide on `ServiceSlideshow` (§7 above) and build it.
4. Build `BaseLayout.astro` (move `index.html`'s `<head>` here).
5. `src/pages/index.astro` — sequence the sections, matching `Home.jsx`'s order.
6. `src/pages/service/[id].astro` + `src/lib/services.js` — move the season/target
   logic out of the component and into plain data/functions, per the plan.
7. `Navbar` and `Seeing` as React islands, `client:load` / `client:visible`
   respectively (Step 3).
8. Everything after that (shadcn, nanostores, TanStack Query, cutover) is
   optional/later per the plan — don't front-load it.

At each step, run `astro dev`, look at the page, compare against `ast_booking`
running side by side (`yarn dev` in that repo, different port). Ask me to review
a specific file once you've written it — that's the most useful place for me to
be helpful without taking the wheel.

---

## 10. Quick reference

- Astro docs index: https://docs.astro.build
- [Routing](https://docs.astro.build/en/guides/routing/)
- [Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Framework components (React islands)](https://docs.astro.build/en/guides/framework-components/)
- [Styling](https://docs.astro.build/en/guides/styling/)
- Client directives reference (the `client:*` list): search "client directives"
  on the docs site — worth reading in full once, it's a short page.
