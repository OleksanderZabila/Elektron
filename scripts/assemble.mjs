// Manual Electron app assembly — produces a runnable Windows app without
// @electron/packager (which silently fails under Node 26 in this environment).
//
// It copies the prebuilt electron runtime from node_modules, drops our built
// app (.vite) + minimal package.json + the runtime dependency closure into
// resources/app, and renames the executable.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const rootNM = path.join(root, 'node_modules');
const OUT = path.join(root, 'out', 'openvsp-agent-win32-x64');

// Runtime deps that the bundled main process still require()s (everything else
// is a node built-in, electron, or bundled into .vite by Vite).
const SEEDS = ['dotenv', '@anthropic-ai/sdk', 'electron-squirrel-startup'];

function readPkg(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}

// Resolve a dependency directory: prefer the package's own nested node_modules,
// fall back to the hoisted root node_modules (npm flattens almost everything).
function resolvePkgDir(name, fromDir) {
  const local = path.join(fromDir, 'node_modules', name);
  if (fs.existsSync(path.join(local, 'package.json'))) return local;
  const hoisted = path.join(rootNM, name);
  if (fs.existsSync(path.join(hoisted, 'package.json'))) return hoisted;
  return null;
}

// BFS the production dependency closure.
const seen = new Set();
const queue = [];
for (const s of SEEDS) {
  const d = path.join(rootNM, s);
  if (fs.existsSync(path.join(d, 'package.json')) && !seen.has(d)) {
    seen.add(d);
    queue.push(d);
  }
}
while (queue.length) {
  const dir = queue.shift();
  const pkg = readPkg(dir);
  if (!pkg) continue;
  for (const dep of Object.keys(pkg.dependencies || {})) {
    const dDir = resolvePkgDir(dep, dir);
    if (dDir && !seen.has(dDir)) {
      seen.add(dDir);
      queue.push(dDir);
    }
  }
}

// 1. Fresh output dir = copy of the electron runtime.
console.log('Cleaning output dir...');
fs.rmSync(OUT, { recursive: true, force: true });
console.log('Copying electron runtime (~350 MB)...');
fs.cpSync(path.join(rootNM, 'electron', 'dist'), OUT, { recursive: true });

// 2. Rename electron.exe -> openvsp-agent.exe
fs.renameSync(path.join(OUT, 'electron.exe'), path.join(OUT, 'openvsp-agent.exe'));

// 3. Drop the default app so electron loads ours.
const defaultApp = path.join(OUT, 'resources', 'default_app.asar');
if (fs.existsSync(defaultApp)) fs.rmSync(defaultApp);

// 4. resources/app/package.json (minimal, production).
const appDir = path.join(OUT, 'resources', 'app');
fs.mkdirSync(appDir, { recursive: true });
const rp = readPkg(root);
fs.writeFileSync(
  path.join(appDir, 'package.json'),
  JSON.stringify(
    {
      name: rp.name,
      productName: rp.productName,
      version: rp.version,
      main: rp.main,
      author: rp.author,
      license: rp.license,
    },
    null,
    2
  )
);

// 5. Copy the built app.
console.log('Copying .vite bundles...');
fs.cpSync(path.join(root, '.vite'), path.join(appDir, '.vite'), { recursive: true });

// 6. Copy the runtime dependency closure.
console.log(`Copying ${seen.size} runtime dependencies...`);
for (const dir of seen) {
  const rel = path.relative(rootNM, dir);
  const dest = path.join(appDir, 'node_modules', rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(dir, dest, { recursive: true });
}

console.log('Bundled deps:', [...seen].map((d) => path.relative(rootNM, d)).join(', '));
console.log('DONE ->', path.join(OUT, 'openvsp-agent.exe'));
