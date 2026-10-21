import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const dist = path.resolve('dist');
const manifest = JSON.parse(await readFile(path.join(dist, 'manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.name, 'How Long Until — Time Highlighter');
assert.ok(manifest.name.length <= 75 && manifest.description.length <= 132);
assert.deepEqual([...manifest.permissions].sort(), ['scripting', 'storage']);
assert.ok(!manifest.host_permissions && !manifest.content_scripts);
assert.ok(manifest.content_security_policy.extension_pages.includes("connect-src 'none'"));
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file); else files.push(file);
  }
}
await walk(dist);
for (const file of files) {
  assert.ok(!/(?:\.env|\.map|package-lock|node_modules|test|credential|token)/i.test(path.relative(dist, file)), `Unwanted package file: ${file}`);
  if (!/\.(?:js|html|css)$/.test(file)) continue;
  const text = await readFile(file, 'utf8');
  assert.ok(!/\b(?:eval|Function|importScripts)\s*\(/.test(text), `Dynamic executable code: ${file}`);
  assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\s*\(/.test(text), `Runtime network API: ${file}`);
  assert.ok(!/<(?:script|iframe)\b[^>]*\bsrc\s*=\s*["']?https?:/i.test(text), `Remote executable source: ${file}`);
  assert.ok(!/@import\s+(?:url\()?\s*["']?https?:/i.test(text), `Remote stylesheet: ${file}`);
}
for (const file of Object.values(manifest.icons)) await readFile(path.join(dist, file));
const zip = `out/howlonguntil-${manifest.version}.zip`;
const entries = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n');
assert.ok(entries.includes('manifest.json'), 'Manifest must be at ZIP root');
assert.ok(entries.every(file => !file.startsWith('/') && !file.split('/').includes('..')));
console.log(`Package checks passed: ${files.length} files; version ${manifest.version}; no runtime network APIs or remote executable resources.`);
