#!/usr/bin/env node
/**
 * Para ajanlari CLI.
 *
 *   node run.mjs --dry-run        # anahtarsiz, fixture ile tam boru hatti
 *   node run.mjs                  # gercek run (API anahtari gerekir)
 *   node run.mjs --ideas 12 --research 5 --max 3 --budget 1.5
 *   node run.mjs --force-new      # WIP kilidini bilerek ac
 *   node run.mjs --liste          # defterdeki fikirler
 *   node run.mjs --pilot <id>     # fikri acik ise al (WIP dolar)
 *   node run.mjs --canli <id>     # para kazaniyor
 *   node run.mjs --oldur <id> "sebep"
 *
 * Ortam: MONEY_LLM_PROVIDER=openai|anthropic  MONEY_LLM_MODEL=...  OPENAI_API_KEY=...
 */
import path from 'node:path';
import { loadConfig, parseArgs, DATA_DIR } from './src/config.mjs';
import { calistir } from './src/pipeline.mjs';
import { raporYaz } from './src/report.mjs';
import { defterYukle, defterKaydet, TUM_DURUMLAR } from './src/ledger.mjs';

const argv = process.argv.slice(2);
const args = parseArgs(argv);
// Durum/liste komutlari da --dry-run ile kuru deftere bakabilsin.
const defterYolu = path.join(DATA_DIR, args.bayraklar.has('--dry-run') ? 'ledger.dry.json' : 'ledger.json');

function yardim() {
  console.log(
    [
      'Kullanim: node run.mjs [secenekler]',
      '',
      '  --dry-run           API anahtari olmadan fixture ile calis',
      '  --ideas N           kasif kac fikir uretsin (varsayilan config)',
      '  --research N        kac fikir derin arastirilsin',
      '  --max N             rapora kac detay girsin',
      '  --budget USD        run maliyet tavani',
      '  --force-new         WIP kilidini gecici olarak ac',
      '  --no-write          rapor/defter yazma (sadece ekrana)',
      '  --out PATH          rapor dosya yolu',
      '  --liste             defteri yazdir',
      '  --pilot|--canli|--oldur|--izle ID   fikir durumu degistir',
      '  --help'
    ].join('\n')
  );
}

function durumDegistir() {
  const eslesme = { '--pilot': 'pilot', '--canli': 'canli', '--oldur': 'olduruldu', '--izle': 'izlemede' };
  const bulunan = Object.keys(eslesme).find((b) => argv.includes(b));
  if (!bulunan) return false;
  const id = argv[argv.indexOf(bulunan) + 1];
  const not = argv[argv.indexOf(bulunan) + 2] || '';
  const defter = defterYukle(defterYolu);
  const fikir = defter.fikirler.find((f) => f.id === id || f.id.startsWith(id));
  if (!fikir) {
    console.error(`fikir bulunamadi: ${id}`);
    process.exitCode = 1;
    return true;
  }
  const yeni = eslesme[bulunan];
  if (!TUM_DURUMLAR.includes(yeni)) throw new Error('gecersiz durum');
  fikir.durum = yeni;
  fikir.guncellendi = new Date().toISOString();
  fikir.gecmis ||= [];
  fikir.gecmis.push({ tarih: fikir.guncellendi, durum: yeni, skor: fikir.skor, not: not || 'elle degistirildi' });
  defterKaydet(defter, defterYolu);
  console.log(`${fikir.baslik} -> ${yeni}`);
  return true;
}

function liste() {
  const defter = defterYukle(defterYolu);
  if (!defter.fikirler.length) return console.log('defter bos.');
  const sirali = defter.fikirler.slice().sort((a, b) => (b.skor || 0) - (a.skor || 0));
  for (const f of sirali) {
    console.log(`${String(f.skor ?? '-').padStart(5)}  ${f.durum.padEnd(10)}  ${f.id.padEnd(48)}  ${f.baslik}`);
  }
  console.log(`\n${defter.fikirler.length} fikir · ${defter.runlar.length} run`);
}

async function main() {
  if (args.bayraklar.has('--help')) return yardim();
  if (args.bayraklar.has('--liste')) return liste();
  if (durumDegistir()) return;

  const cfg = loadConfig(argv);
  const log = cfg.calisma.sessiz ? () => {} : console.log;
  const sonuc = await calistir(cfg, { log, defterYolu: cfg.calisma.defterYolu });

  if (cfg.calisma.raporYazma) {
    const yol = raporYaz(cfg, sonuc);
    defterKaydet(sonuc.defter, cfg.calisma.defterYolu);
    log(`\nrapor: ${yol}`);
    log(`defter: ${sonuc.defter.fikirler.length} fikir`);
  } else {
    console.log('\n' + (await import('./src/report.mjs')).raporUret(cfg, sonuc));
  }

  log(
    cfg.llm.saglayici === 'cursor'
      ? `cagri: ${sonuc.kullanim.cagri}/${cfg.akis.runCagriTavani} (Cursor havuzu, ${sonuc.kullanim.hata} yeniden deneme)`
      : `maliyet: $${sonuc.kullanim.usd.toFixed(4)} (${sonuc.kullanim.cagri} cagri, ${sonuc.kullanim.hata} yeniden deneme)`
  );
  if (sonuc.uyarilar.length) log(`uyari: ${sonuc.uyarilar.length}`);
}

main().catch((e) => {
  console.error(`HATA: ${e.message}`);
  process.exit(1);
});
