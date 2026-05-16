# Platform backports

Patterns the Brand Profile Wizard (BPW) developed that other Go Ultra AI Drupal Asset Injector apps (WCP, CP, SCP, User Profile, future apps) may want to adopt. None of these are mandatory — they're surfaced here so a future cross-app refactor has a concrete reference instead of "BPW does something different, what was it again?"

Each entry: what BPW does, why it helps, what it costs to adopt elsewhere.

---

## 1. Semantic folder layout (instead of numbered Parts)

**BPW source layout:**

```
src/
├── core/          state, schema, constants, migration
├── ai/
│   ├── providers/ one file per LLM provider (gemini.js, claude.js, …)
│   ├── actions/   one file per AI action group (identity, voice, refine, …)
│   ├── llm-service.js
│   └── brand-service.js
├── ui/
│   ├── editors/   inline editing surface (fields, prose, path-store)
│   ├── views/     one file per section view (identity, voice, …)
│   └── (shell components: topbar, sidebar, detail-pane, …)
├── setup/         setup wizard / orchestrator
├── utils/         dom, helpers
├── styles/        tokens, reset, responsive
└── legacy/        quarantined pre-refactor monolith files
```

**Why it helps:** new contributors can find code by feature without learning the load-order metaphor. "Where do I add a new LLM provider?" → `src/ai/providers/`. The folder name is the answer.

**Cost to adopt in a sibling:** medium-large refactor — pure file moves with no content edits, but every workflow / docs reference to old paths needs updating, and `git log --follow` is required to keep history readable.

---

## 2. Per-category `_category.md` READMEs

Each top-level `src/<category>/` folder contains a short `_category.md` that documents the folder's contract — what belongs here, what doesn't, what the conventions are.

**Why it helps:** when a contributor opens `src/ai/`, the first file they see (alphabetically) is `_category.md`. No need to grep the docs.

**Cost to adopt:** trivial — write one short Markdown file per folder. Low controversy.

---

## 3. ESM source → IIFE bundle via esbuild

BPW writes ES module source (`import './foo.js'`) and bundles to a single IIFE for Asset Injector consumption. The bundler is esbuild (one dev dependency, ~5 MB).

**Why it helps:**
- `import` statements make load-order explicit and tooling-checkable
- esbuild generates sourcemaps and CSS bundles for free
- Tree-shakes unused exports
- Build runs in ~250 ms even on the full BPW source

**Cost to adopt:** small — add `esbuild` as a devDependency, write a ~50-line build script, replace `<script>` tag concatenation with `import` statements at module tops. The runtime output (one IIFE per app) is identical to hand-concatenated alternatives.

**Caveat:** sibling apps that today have *zero* `node_modules` would gain one. If that's a hard constraint, this backport doesn't apply.

---

## 4. Sourcemap distribution (`.map` files committed)

BPW commits both `dist/bpw.min.js.map` and `dist/bpw.js.map` alongside the bundles. jsDelivr serves them; devtools picks them up automatically.

**Why it helps:** production crashes show original source line numbers in the stack trace, not minified column offsets.

**Cost to adopt:** ~3 MB per app in repo bloat. Free in build time (esbuild emits maps anyway).

---

## 5. Dual-globals coexistence pattern for legacy migration

BPW is mid-refactor: the old monolith (`src/legacy/bpw-app.js` + parts 2a/2b/2c) still loads alongside new feature modules. The two coexist via a deliberate global-namespace split:

- **New code** writes un-prefixed globals: `window.LLMService`, `window.BrandService`, `window._bpwAIProviders`
- **Legacy code** writes its own `window._bpwLLMService` alias inside its IIFE
- Both run; new consumers read the new globals, legacy consumers read the legacy alias, neither clobbers the other

`src/index.js` documents this load-order assumption in a top-of-file comment.

**Why it helps:** lets a full refactor happen incrementally over many PRs without ever shipping a half-migrated app. Each module migration is independently safe.

**Cost to adopt:** zero new dependencies; just a discipline. Useful for any sibling app planning a similar feature-by-feature migration off a monolith.

---

## 6. Build-injected version + build-time globals

BPW's build script injects two globals at the bundle wrapper, outside any feature IIFE:

```js
window.BPW_VERSION     // from package.json
window.BPW_BUILD_TIME  // ISO timestamp captured at build
```

Plus a one-line styled console banner on bundle load.

**Why it helps:** "is the bundle fresh?" becomes a one-line devtools check. No source inspection needed when chasing a "this looks like an old version" report.

**Cost to adopt:** ~10 lines in the build script. Zero runtime cost. Sibling apps just need to substitute their own prefix (`window.WCP_VERSION`, etc.).

---

## 7. Dual bundle outputs (min + unmin)

The build emits both `bpw.min.{js,css}` (production) and `bpw.{js,css}` (debug). Production Asset Injector loads the minified pair; a separate staging rule can load the unminified pair when reproducing a bug.

**Why it helps:** debugging Asset Injector-loaded code with sourcemaps works, but reading the unminified bundle directly is faster when you're staring at a strange variable name in a stack trace.

**Cost to adopt:** one extra esbuild call in the build script. ~5 MB per app of repo bloat.
