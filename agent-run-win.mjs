#!/usr/bin/env node
/**
 * Windows Cursor CLI kosucusu.
 *
 * Neden var:
 * - spawn('cursor-agent') .cmd shim'de ENOENT verir
 * - Prompt'u stdin'e vermek gercek CLI'de asili kalabiliyor (prompt argv bekliyor)
 * - PowerShell 5.1 native argv'yi boslukta bolup "-14" bayrak sanabiliyor
 *
 * `where` ile .cmd yolunu bulur, mumkunse arkasindaki node/exe'ye iner,
 * prompt'u tek argv olarak `--` sonrasinda verir.
 *
 * Kullanim:
 *   node agent-run-win.mjs <komut> <model> <promptDosyasi> [--trust -f ...]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { whereExe, cmdShimCozumle } from './src/win-cmd-shim.mjs';

const [komutAd, model, promptDosya, ...ekBayraklar] = process.argv.slice(2);
if (!komutAd || !model || !promptDosya) {
  console.error('Kullanim: node agent-run-win.mjs <komut> <model> <promptDosyasi> [ek bayraklar]');
  process.exit(2);
}
if (!fs.existsSync(promptDosya)) {
  console.error(`Prompt dosyasi yok: ${promptDosya}`);
  process.exit(2);
}

const prompt = fs.readFileSync(promptDosya, 'utf8');
const cmdPath = whereExe(komutAd) || komutAd;
const plan =
  /\.cmd$/i.test(cmdPath) || /\.bat$/i.test(cmdPath)
    ? cmdShimCozumle(cmdPath)
    : { cmd: cmdPath, baseArgs: [], shell: false };

const args = [...plan.baseArgs, '-p', ...ekBayraklar, '--model', model, '--output-format', 'text', '--', prompt];

const cocuk = spawn(plan.cmd, args, {
  shell: plan.shell,
  windowsHide: true,
  stdio: ['ignore', 'inherit', 'inherit']
});

cocuk.on('error', (e) => {
  console.error(`cursor cli baslatilamadi (${plan.cmd}): ${e.message}`);
  process.exit(1);
});
cocuk.on('close', (kod) => process.exit(kod ?? 1));
