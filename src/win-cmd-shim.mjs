/**
 * Windows .cmd shim cozumleyici — Cursor CLI'nin arkasindaki node/exe'yi bulur.
 * shell:true + uzun prompt, cmd.exe 8191 limitinde denetci cagrilarini oldurur.
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

function nodeIle(script, dir, nodeExe) {
  const localNode = path.join(dir, 'node.exe');
  return {
    cmd: fs.existsSync(localNode) ? localNode : nodeExe,
    baseArgs: [script],
    shell: false
  };
}

/** Ayni klasorde / versions/ altinda bilinen giris dosyalarini ara. */
export function dizinTara(dir, { nodeExe = process.execPath } = {}) {
  const adaylar = ['index.js', 'dist/index.js', 'cursor-agent.js', 'agent.js', 'cli.js', 'bin/index.js'];
  for (const a of adaylar) {
    const p = path.join(dir, a);
    if (fs.existsSync(p)) return nodeIle(p, dir, nodeExe);
  }

  for (const ara of ['current', 'latest']) {
    const base = path.join(dir, ara);
    if (!fs.existsSync(base)) continue;
    for (const a of adaylar) {
      const p = path.join(base, a);
      if (fs.existsSync(p)) return nodeIle(p, base, nodeExe);
    }
  }

  const versions = path.join(dir, 'versions');
  if (fs.existsSync(versions)) {
    let subs = [];
    try {
      subs = fs
        .readdirSync(versions, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort()
        .reverse();
    } catch {
      subs = [];
    }
    for (const s of subs) {
      const base = path.join(versions, s);
      for (const a of adaylar) {
        const p = path.join(base, a);
        if (fs.existsSync(p)) return nodeIle(p, base, nodeExe);
      }
    }
  }
  return null;
}

/** .cmd shim arkasindaki gercek node script / exe. */
export function cmdShimCozumle(cmdPath, { nodeExe = process.execPath } = {}) {
  const dir = path.dirname(cmdPath);
  if (/\.exe$/i.test(cmdPath)) return { cmd: cmdPath, baseArgs: [], shell: false };

  let body = '';
  try {
    body = fs.readFileSync(cmdPath, 'utf8');
  } catch {
    return dizinTara(dir, { nodeExe }) || { cmd: cmdPath, baseArgs: [], shell: true, cozulemedi: true };
  }

  const js =
    body.match(/"%~dp0[/\\]?([^"]+\.(?:js|mjs|cjs))"/i) ||
    body.match(/%~dp0[/\\]?(\S+\.(?:js|mjs|cjs))/i) ||
    body.match(/"([^"]+[\\/][^"]+\.(?:js|mjs|cjs))"/i);
  if (js) {
    const ham = js[1];
    const script = path.isAbsolute(ham) ? ham : path.join(dir, ham);
    if (fs.existsSync(script)) return nodeIle(script, path.dirname(script), nodeExe);
  }

  const exe =
    body.match(/"%~dp0[/\\]?([^"]+\.exe)"/i) ||
    body.match(/%~dp0[/\\]?(\S+\.exe)/i);
  if (exe) {
    const hedef = path.join(dir, exe[1]);
    if (fs.existsSync(hedef)) return { cmd: hedef, baseArgs: [], shell: false };
  }

  const tarama = dizinTara(dir, { nodeExe });
  if (tarama) return tarama;

  return { cmd: cmdPath, baseArgs: [], shell: true, cozulemedi: true };
}

/** Windows CreateProcess ~32k; cmd.exe shell:true ise ~8k. Guvenli esik. */
export const WIN_ARGV_ESIK = 6000;

export function cliHataMetni(hata, cikti, limit = 800) {
  const temiz = String(hata || '')
    .split(/\r?\n/)
    .filter((l) => l && !/DEP0190|DeprecationWarning/i.test(l))
    .join('\n')
    .trim();
  return (temiz || String(cikti || hata || '').trim()).slice(0, limit);
}
