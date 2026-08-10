/**
 * Windows .cmd shim cozumleyici — Cursor CLI'nin arkasindaki node/exe'yi bulur.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function whereExe(ad) {
  const r = spawnSync('where.exe', [ad], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  return (
    r.stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find((s) => s) || null
  );
}

/** .cmd shim arkasindaki gercek node script / exe. */
export function cmdShimCozumle(cmdPath, { nodeExe = process.execPath } = {}) {
  const dir = path.dirname(cmdPath);
  if (/\.exe$/i.test(cmdPath)) return { cmd: cmdPath, baseArgs: [], shell: false };

  let body = '';
  try {
    body = fs.readFileSync(cmdPath, 'utf8');
  } catch {
    return { cmd: cmdPath, baseArgs: [], shell: true };
  }

  const js = body.match(/"%~dp0[/\\]?([^"]+\.(?:js|mjs|cjs))"/i);
  if (js) {
    const script = path.join(dir, js[1]);
    const localNode = path.join(dir, 'node.exe');
    return { cmd: fs.existsSync(localNode) ? localNode : nodeExe, baseArgs: [script], shell: false };
  }

  const exe = body.match(/"%~dp0[/\\]?([^"]+\.exe)"/i);
  if (exe) return { cmd: path.join(dir, exe[1]), baseArgs: [], shell: false };

  return { cmd: cmdPath, baseArgs: [], shell: true };
}
