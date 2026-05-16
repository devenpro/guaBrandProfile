import { build, context } from 'esbuild';
import { readFileSync, rmSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const VERSION = pkg.version;
const BUILD_TIME = new Date().toISOString();

const bannerJs = [
  `window.BPW_VERSION=${JSON.stringify(VERSION)};`,
  `window.BPW_BUILD_TIME=${JSON.stringify(BUILD_TIME)};`,
  `try{console.log("%c[BPW] v"+window.BPW_VERSION+" ("+window.BPW_BUILD_TIME+")","color:#5b8def;font-weight:bold");}catch(e){}`,
].join('');

const baseConfig = {
  entryPoints: ['src/index.js', 'src/index.css'],
  bundle: true,
  sourcemap: true,
  format: 'iife',
  target: ['es2018'],
  outdir: 'dist',
  loader: { '.css': 'css' },
  logLevel: 'info',
  legalComments: 'none',
  banner: { js: bannerJs },
};

const minifiedConfig = {
  ...baseConfig,
  minify: true,
  entryNames: 'bpw.min',
};

const unminifiedConfig = {
  ...baseConfig,
  minify: false,
  entryNames: 'bpw',
};

const isWatch = process.argv.includes('--watch');

rmSync('dist', { recursive: true, force: true });

if (isWatch) {
  const minCtx = await context(minifiedConfig);
  const devCtx = await context(unminifiedConfig);
  await minCtx.watch();
  await devCtx.watch();
  console.log('\nWatching src/ — rebuilding bpw.js + bpw.min.js on change. Ctrl+C to stop.');
} else {
  const [minResult, devResult] = await Promise.all([
    build(minifiedConfig),
    build(unminifiedConfig),
  ]);
  const warnings = minResult.warnings.length + devResult.warnings.length;
  if (warnings) {
    console.warn(`\n${warnings} warning(s) reported above.`);
  }
  console.log(`\nBuild complete: BPW v${VERSION} @ ${BUILD_TIME}`);
  console.log('  → dist/bpw.min.js, dist/bpw.min.css (production)');
  console.log('  → dist/bpw.js, dist/bpw.css (debug/staging)');
}
