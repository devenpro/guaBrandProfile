# Deployment — Drupal Asset Injector

The Brand Profile Wizard ships as **one** minified JS bundle plus **one** minified CSS bundle in [`dist/`](../dist/), with a matching pair of unminified bundles for debugging. This document covers the two deployment modes — pick one per Drupal environment.

| Bundle | Purpose | Asset Injector? |
|---|---|---|
| `bpw.min.js` + `bpw.min.css` | Production | **Yes** — default loader target |
| `bpw.js` + `bpw.css` | Staging / debug / paste-in inspection | Optional — point a separate staging Asset Injector rule here when reproducing a bug |

Every build also injects two read-only globals at the bundle wrapper, so devtools can answer "which build is live" without source inspection:

```js
window.BPW_VERSION     // e.g. "0.1.0"  — from package.json at build time
window.BPW_BUILD_TIME  // e.g. "2026-05-16T12:27:28.604Z"  — UTC ISO string
```

A styled `[BPW] v… (…)` line is also logged to the console on bundle load.

---

## Mode A — CDN loader (recommended)

Paste **one loader snippet** into Asset Injector's **JS Injector** field. The loader pulls both the JS and the CSS from jsDelivr; the Asset Injector CSS field stays empty.

### Step 1 — Create a JS Injector rule

`Admin → Configuration → Development → Asset Injector → JS Injector → Add JS Injector`

- **Label:** `Brand Profile Wizard`
- **Internal name:** `brand_profile_wizard`
- **Code (paste this verbatim):**

```js
(function () {
  // ── version: hybrid pattern ──────────────────────────────────
  //   '@v0.1.0'  production: pin to the tag CI published. Rollback
  //              = change to the previous tag, save, drush cr.
  //   '@latest'  staging: auto-follows newest GitHub Release. Use on
  //              staging environments to smoke-test before promoting
  //              the matching tag to production.
  //   '@main'    avoid in production: every push lands within
  //              jsDelivr's ~12 h cache TTL with no rollback target.
  // ─────────────────────────────────────────────────────────────
  var v = '@v0.1.0';
  var base = 'https://cdn.jsdelivr.net/gh/devenpro/guaBrandProfile' + v + '/dist/';

  var s = document.createElement('script');
  s.src = base + 'bpw.min.js';
  s.defer = true;
  document.head.appendChild(s);

  var l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = base + 'bpw.min.css';
  document.head.appendChild(l);
})();
```

For **staging** Drupal sites, create a second Asset Injector rule with `v = '@latest'`. The CI release workflow tags each version bump on `main` and publishes a GitHub Release; jsDelivr resolves `@latest` to whichever tag was published most recently.

- **Page paths:** restrict to brand-profile node edit pages, e.g.
  ```
  /node/*/edit
  /node/add/brand_profile
  ```
- **Content types:** check `Brand profile`.
- **Save.**

### Step 2 — Test

Open a brand-profile node edit page. The wizard should mount within ~300 ms after first load (subsequent loads are cached by the browser and jsDelivr).

### Step 3 — Redeploy when source changes

The release loop with CI in place:

1. Open a PR with source + rebuilt `dist/` + a `package.json` version bump.
2. Squash-merge to `main`.
3. The `Release` workflow (`.github/workflows/release.yml`) detects the new version, creates the `vX.Y.Z` tag, and publishes a GitHub Release with the bundle attached. Staging Asset Injector rules pinned to `@latest` pick up the new bundle within jsDelivr's cache TTL (~12 h, or immediately via purge URL below).
4. Smoke-test on staging.
5. Edit the **production** Asset Injector rule, change `v = '@v0.1.0'` to `v = '@v0.2.0'` (or whatever the new tag is), save, run `drush cr`. jsDelivr caches tagged versions permanently, so production never sees an unexpected swap.

To bust jsDelivr's cache for the staging `@latest` URL immediately:

```
https://purge.jsdelivr.net/gh/devenpro/guaBrandProfile@latest/dist/bpw.min.js
https://purge.jsdelivr.net/gh/devenpro/guaBrandProfile@latest/dist/bpw.min.css
```

Manual override (no CI / no version bump): you can still drop straight to `v = '@<commit-sha>'` for a one-off pin to a specific commit. jsDelivr resolves any git ref.

---

## Mode B — Paste bundle content

Use this when you cannot rely on outbound HTTPS to jsDelivr (offline / locked-down environments).

### Step 1 — Build locally

```sh
npm install
npm run build
```

This produces:
- `dist/bpw.min.js` + `.map` — minified, what production Asset Injector loads
- `dist/bpw.min.css` + `.map` — minified CSS
- `dist/bpw.js` + `.map` — unminified, for staging / paste-in debugging
- `dist/bpw.css` + `.map` — unminified CSS

### Step 2 — Paste into Asset Injector

- **JS Injector rule** → paste the entire contents of `dist/bpw.min.js`.
- **CSS Injector rule** → paste the entire contents of `dist/bpw.min.css`.
- Apply the same page-paths and content-type restrictions as Mode A.

### Step 3 — Redeploy

Repeat Step 1 and Step 2 every time the source changes. There is no auto-update path in this mode.

---

## Asset Injector weights

The bundle is one IIFE — load order between the four legacy parts is now internal, so you no longer need separate rules with different weights as the old setup did. A single JS Injector rule at any weight is enough.

If you keep any **legacy** Asset Injector rules for the old `bpw-part2a.js` / `part2b.js` / `part2c.js`, **disable or delete them** to avoid double-loading.

---

## Verifying the deployment

In the browser console on a brand-profile edit page:

```js
window.BPW_VERSION      // → e.g. "0.1.0"
window.BPW_BUILD_TIME   // → e.g. "2026-05-16T12:27:28.604Z"
window._bpwState        // → object with .initialized = true
window._bpwPart2A       // → object
window._bpwPart2B       // → object
window._bpwPart2C       // → object
```

If `BPW_VERSION` is missing, the bundle never loaded. If it's there but doesn't match the tag you expect, jsDelivr may be serving a stale cached copy — see the cache-busting URLs above.

If any of these are `undefined`, the bundle did not load or did not initialise — check the Network tab for failed requests and the Console tab for errors.

---

## Rollback

- **Production (tag-pinned):** edit the Asset Injector rule, change `v` to the previous tag (e.g. `'@v0.1.0'`), save, run `drush cr`. No repo-side change needed. jsDelivr already has the old tag cached, so propagation is immediate.
- **Staging (`@latest`):** if you don't want `@latest` to track a broken release, pin staging temporarily to a known-good tag using the same procedure as production.
- **Paste mode:** keep a backup of the previous `bpw.min.js` / `bpw.min.css` contents and paste them back.

---

## Security checklist before each release

- [ ] No API keys, tokens, or `.env` values in `src/` or `dist/`. The codebase reads LLM keys from runtime DOM (`.llm-config-data` / `.llm-brand-config-data`); they should never be committed.
- [ ] `git status` shows no untracked files containing secrets.
- [ ] `dist/` only contains `bpw.{min,}.{js,css}` and their `.map` files.
