/**
 * Cursor CLI saglayicisi — API faturasi yerine Cursor uyeligindeki havuzu kullanir.
 *
 * Cagri sekli:
 *   agent -p --trust -f --model <model> --output-format text [--] <prompt>
 *
 * Prompt tasima:
 *   ps1   (varsayilan Windows) — PowerShell sarmalayici; .cmd shim'lerini bulur,
 *                                prompt dosyadan STDIN'e (argv kirlenmez, -14 olmaz)
 *   stdin — prompt cocugun stdin'ine; Windows'ta shell:true ile .cmd cozulur
 *   argv  (varsayilan posix) — prompt son arguman; `--` ile bayrak sanilmaz
 *
 * Guvenlik: cagri her zaman gecici bos bir dizinde kosar. `-f` ile komut onayi
 * otomatik verildigi icin ajan bir arac calistirmaya kalkarsa depo disinda kalir.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BURASI = path.dirname(fileURLToPath(import.meta.url));
export const PS1_YOLU = path.join(BURASI, '..', 'agent-run.ps1');

/** "agent" ya da "node fake.mjs" gibi bosluklu komutlari parcalar. */
export function komutParcala(komut) {
  const p = String(komut).trim().split(/\s+/);
  return { cmd: p[0], onEkArgs: p.slice(1) };
}

function komutVarMi(cmd) {
  const kontrol = process.platform === 'win32' ? ['where', [cmd]] : ['sh', ['-c', `command -v ${cmd}`]];
  try {
    return spawnSync(kontrol[0], kontrol[1], { stdio: 'ignore' }).status === 0;
  } catch {
    return false;
  }
}

/** Sirasiyla: acik ayar -> ortam -> cursor-agent -> agent. */
export function komutBul(ayar = {}) {
  const acik = process.env.MONEY_CURSOR_CMD || ayar.komut;
  if (acik) return acik;
  for (const aday of ['cursor-agent', 'agent']) if (komutVarMi(aday)) return aday;
  return 'agent';
}

/**
 * Windows varsayilanı ps1: npm/Cursor .cmd shim'lerini PowerShell bulur;
 * prompt STDIN ile gider (eski argv yolu ENOENT veya unknown option '-14' verirdi).
 */
export function modBul(ayar = {}) {
  const m = process.env.MONEY_CURSOR_MODE || ayar.mod || 'oto';
  if (m !== 'oto') return m;
  return process.platform === 'win32' ? 'ps1' : 'argv';
}

/**
 * Calistirilacak komutu kurar. Saf fonksiyon: test edilebilir, yan etkisi yok.
 * mod=argv  -> prompt argv'de (`--` sonrasi; posix)
 * mod=stdin -> prompt cocugun stdin'ine yazilir
 * mod=ps1   -> powershell sarmalayici, prompt dosyadan STDIN ile
 */
export function komutKur({ komut, model, prompt, ekBayraklar = [], mod = 'argv', promptDosyasi = null }) {
  const { cmd, onEkArgs } = komutParcala(komut);
  const temel = [...onEkArgs, '-p', ...ekBayraklar, '--model', model, '--output-format', 'text'];
  // Windows'ta shell:true olmadan spawn('cursor-agent') .cmd shim icin ENOENT verir.
  const winKabuk = process.platform === 'win32';

  if (mod === 'ps1') {
    return {
      cmd: 'powershell.exe',
      args: [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        PS1_YOLU,
        '-Komut',
        cmd,
        '-Model',
        model,
        '-PromptDosyasi',
        promptDosyasi,
        '-EkBayraklar',
        ekBayraklar.join(' ')
      ],
      stdinMi: false,
      kabuk: false
    };
  }
  if (mod === 'stdin') return { cmd, args: temel, stdinMi: true, kabuk: winKabuk };
  // `--` : prompt "-14 ..." ile baslasa bile CLI onu secenek sanmaz.
  return { cmd, args: [...temel, '--', prompt], stdinMi: false, kabuk: winKabuk };
}

export async function cursorCagir({ komut, model, prompt, ekBayraklar, mod, timeoutMs = 300000 }) {
  const gecici = fs.mkdtempSync(path.join(os.tmpdir(), 'money-agent-'));
  const promptDosyasi = path.join(gecici, 'prompt.txt');
  if (mod === 'ps1') fs.writeFileSync(promptDosyasi, prompt, 'utf8');

  const plan = komutKur({ komut, model, prompt, ekBayraklar, mod, promptDosyasi });
  const basla = Date.now();

  try {
    return await new Promise((cozum, red) => {
      const cocuk = spawn(plan.cmd, plan.args, { cwd: gecici, shell: plan.kabuk, windowsHide: true });
      let cikti = '';
      let hata = '';
      const zamanlayici = setTimeout(() => {
        cocuk.kill('SIGKILL');
        red(new Error(`cursor cli zaman asimi (${timeoutMs} ms)`));
      }, timeoutMs);

      cocuk.stdout.on('data', (d) => (cikti += d));
      cocuk.stderr.on('data', (d) => (hata += d));
      cocuk.on('error', (e) => {
        clearTimeout(zamanlayici);
        // Binary yoksa yeniden denemenin anlami yok: kalici hata olarak isaretle.
        const ek =
          e.code === 'ENOENT'
            ? ` — '${plan.cmd}' PATH'te yok veya Windows .cmd shim spawn edilemedi. Cursor CLI kurulu mu? CMD'de: where cursor-agent`
            : '';
        red(Object.assign(new Error(`cursor cli baslatilamadi (${plan.cmd}): ${e.message}${ek}`), { kalici: true }));
      });
      cocuk.on('close', (kod) => {
        clearTimeout(zamanlayici);
        if (kod !== 0) return red(new Error(`cursor cli exit ${kod}: ${hata.slice(0, 300) || cikti.slice(0, 300)}`));
        // Token sayaci yok; maliyet Cursor havuzundan dusuyor. Kabaca raporlanir.
        cozum({
          metin: cikti,
          girdiTok: Math.ceil(prompt.length / 4),
          ciktiTok: Math.ceil(cikti.length / 4),
          sureMs: Date.now() - basla
        });
      });

      if (plan.stdinMi) {
        cocuk.stdin.write(prompt);
        cocuk.stdin.end();
      }
    });
  } finally {
    fs.rmSync(gecici, { recursive: true, force: true });
  }
}
