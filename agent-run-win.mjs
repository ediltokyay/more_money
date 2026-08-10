#!/usr/bin/env node
/**
 * Windows Cursor CLI kosucusu.
 *
 * - .cmd shim'i gercek node/exe'ye cozer (shell:true + 8191 limiti olmesin)
 * - Uzun prompt'lari stdin ile verir (denetci dosyalari argv'ye sigmaz)
 * - Kisa prompt'lari `--` sonrasi tek argv olarak verir
 *
 *   node agent-run-win.mjs <komut> <model> <promptDosyasi> [--trust -f ...]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { whereExe, cmdShimCozumle, WIN_ARGV_ESIK } from './src/win-cmd-shim.mjs';

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

if (plan.cozulemedi || plan.shell) {
  console.error(
    `Uyari: '${komutAd}' shim'i cozulemedi (${cmdPath}). ` +
      'stdin ile denenecek; kalici cozum icin: type "%LOCALAPPDATA%\\cursor-agent\\cursor-agent.cmd"'
  );
}

// shell:true iken ASLA uzun prompt argv'ye konmaz (cmd 8191).
const argvIle = !plan.shell && prompt.length <= WIN_ARGV_ESIK;
const args = argvIle
  ? [...plan.baseArgs, '-p', ...ekBayraklar, '--model', model, '--output-format', 'text', '--', prompt]
  : [...plan.baseArgs, '-p', ...ekBayraklar, '--model', model, '--output-format', 'text'];

const cocuk = spawn(plan.cmd, args, {
  shell: Boolean(plan.shell),
  windowsHide: true,
  stdio: argvIle ? ['ignore', 'inherit', 'inherit'] : ['pipe', 'inherit', 'inherit']
});

cocuk.on('error', (e) => {
  console.error(`cursor cli baslatilamadi (${plan.cmd}): ${e.message}`);
  process.exit(1);
});

if (!argvIle) {
  cocuk.stdin.on('error', () => {});
  cocuk.stdin.write(prompt);
  cocuk.stdin.end();
}

cocuk.on('close', (kod) => process.exit(kod ?? 1));
