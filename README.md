# Brand Profile Wizard (BPW)

A 12-step, AI-powered brand profile builder that runs inside a Drupal node-edit form via the [Asset Injector](https://www.drupal.org/project/asset_injector) module.

- **One bundled JS + one bundled CSS** in [`dist/`](dist/) — deploy via jsDelivr CDN or paste directly into Asset Injector. Each build emits both a minified bundle (`bpw.min.{js,css}`, what Asset Injector loads) and an unminified bundle (`bpw.{js,css}`, for staging / debugging), each with sourcemaps.
- **Source organised by feature** in [`src/`](src/) — `core/`, `ui/`, `editing/`, `ai/`, `settings/`, `activity/`, `utils/`, `styles/`.
- **Multi-provider AI** — Gemini, Claude, OpenAI, OpenRouter, Grok, custom.
- **No bundled secrets** — API keys are read from the Drupal DOM at runtime.

## Quick start — Drupal deployment

In your Drupal site, create an Asset Injector "JS Injector" rule on the brand-profile content type with this loader (CSS is injected by the loader itself, so the CSS Injector field can stay empty):

```js
(function () {
  // Hybrid pattern: pin production to a tag, point staging at @latest.
  //   var v = '@v0.1.0';   // production — explicit, rollback-friendly
  //   var v = '@latest';   // staging   — auto-follows newest release
  var v = '@v0.1.0';
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/gh/devenpro/guaBrandProfile' + v + '/dist/bpw.min.js';
  document.head.appendChild(s);
  var l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://cdn.jsdelivr.net/gh/devenpro/guaBrandProfile' + v + '/dist/bpw.min.css';
  document.head.appendChild(l);
})();
```

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for paste-the-bundle mode, version pinning, and cache busting.

## Local development

```sh
npm install
npm run build         # one-shot build → dist/bpw.min.{js,css}
npm run watch         # rebuild on save
```

After a build, either:

1. Copy the contents of `dist/bpw.min.js` and `dist/bpw.min.css` into Drupal Asset Injector for local testing, or
2. Push to GitHub and let jsDelivr serve the updated bundle.

## Project layout

```
src/
├── core/        state, navigation, schema, autosave, drupal-sync
├── ui/          shell, components, renderers/<screen>.js
├── editing/     inline editor, persona/offering/social builders
├── ai/          llm-service, prompts, step-runners, scrapers
├── settings/    settings modal + user prefs
├── activity/    activity log + instrumentation
├── utils/       helpers, dom, logger, timing
├── styles/      tokens, reset, components, layout, screens, responsive
├── index.js     main entry — wires every module
└── index.css    CSS entry
dist/            built bundles (tracked for CDN consumers)
docs/            architecture, API reference, deployment, dev guide
examples/        stage-N JSON fixtures
scripts/         build script (esbuild)
```

> **Note:** at v0.1.0 the four monolithic source files live in `src/legacy/` while the feature modules under `src/core/`, `src/ui/`, etc. are populated incrementally. See [`docs/REFACTOR-PLAN.md`](docs/REFACTOR-PLAN.md) for the migration plan.

## Documentation

- [Architecture](docs/BPW-ARCHITECTURE.md)
- [API reference](docs/BPW-API-REFERENCE.md)
- [Development guide](docs/BPW-DEVELOPMENT-GUIDE.md)
- [Field mapping (Drupal)](docs/BPW-FIELD-MAPPING.md)
- [Quick reference](docs/BPW-QUICK-REFERENCE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Project conventions](docs/PROJECT.md)
- [Platform backports](docs/PLATFORM-BACKPORTS.md) — patterns BPW developed that other Go Ultra AI apps may want to adopt

## License

[MIT](LICENSE).
