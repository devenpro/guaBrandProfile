import { build, context } from 'esbuild';
import { rmSync } from 'node:fs';

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
  console.log('\nBuild complete: dist/bpw.min.js, dist/bpw.min.css');
}
