import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const [entry, format] of [['content', 'iife'], ['popup', 'iife'], ['background', 'esm']]) {
  await build({ entryPoints: [path.join(root, `src/${entry}.js`)], outfile: path.join(dist, `${entry}.js`),
    bundle: true, platform: 'browser', format, target: 'chrome140', minify: false,
    legalComments: 'eof', sourcemap: false, charset: 'utf8' });
}
for (const file of ['popup.html', 'popup.css', 'content.css']) {
  await cp(path.join(root, 'src', file), path.join(dist, file));
}
await cp(path.join(root, 'manifest.json'), path.join(dist, 'manifest.json'));
await cp(path.join(root, 'assets', 'icons'), path.join(dist, 'assets', 'icons'), { recursive: true });
await cp(path.join(root, 'LICENSE'), path.join(dist, 'LICENSE'));
const notices = [
  'Third-party notices for bundled libraries. No code is loaded remotely at runtime.',
  '\n@js-temporal/polyfill 0.5.1 (ISC)',
  await readFile(path.join(root, 'node_modules/@js-temporal/polyfill/LICENSE'), 'utf8'),
  '\njsbi (Apache-2.0)',
  await readFile(path.join(root, 'node_modules/jsbi/LICENSE'), 'utf8'),
].join('\n');
await writeFile(path.join(dist, 'THIRD_PARTY_NOTICES.txt'), notices);
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
await mkdir(path.join(root, 'out'), { recursive: true });
const zip = path.join(root, 'out', `howlonguntil-${manifest.version}.zip`);
await rm(zip, { force: true });
execFileSync('zip', ['-q', '-r', zip, '.'], { cwd: dist });
console.log(`Built ${path.relative(root, dist)}/ and ${path.relative(root, zip)}`);
