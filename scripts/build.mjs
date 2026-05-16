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

const config = {
  entryPoints: ['src/index.js', 'src/index.css'],
  bundle: true,
  minify: true,
  sourcemap: true,
  format: 'iife',
  target: ['es2018'],
  outdir: 'dist',
  entryNames: 'bpw.min',
  loader: { '.css': 'css' },
  logLevel: 'info',
  legalComments: 'none',
  banner: { js: bannerJs },
};

const isWatch = process.argv.includes('--watch');

rmSync('dist', { recursive: true, force: true });

if (isWatch) {
  const ctx = await context(config);
  await ctx.watch();
  console.log('\nWatching src/ — rebuilding on change. Ctrl+C to stop.');
} else {
  const result = await build(config);
  if (result.warnings.length) {
    console.warn(`\n${result.warnings.length} warning(s) reported above.`);
  }
  console.log(`\nBuild complete: BPW v${VERSION} @ ${BUILD_TIME}`);
  console.log('  → dist/bpw.min.js, dist/bpw.min.css');
}
