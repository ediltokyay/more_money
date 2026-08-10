/**
 * Config yukleme + CLI override + dogrulama.
 * Kaynak sira: config.json  <  ortam degiskenleri  <  CLI bayraklari
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const REPORT_DIR = path.join(ROOT, 'reports');

const SAYI_BAYRAKLARI = {
  '--ideas': ['akis', 'havuzFikir'],
  '--research': ['akis', 'arastirilacak'],
  '--max': ['akis', 'raporaGirenMax'],
  '--wip': ['akis', 'wipLimiti'],
  '--budget': ['akis', 'runButceUSD']
};

function derinKopya(o) {
  return JSON.parse(JSON.stringify(o));
}

function ata(obj, yol, deger) {
  let k = obj;
  for (const p of yol.slice(0, -1)) k = k[p];
  k[yol[yol.length - 1]] = deger;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { bayraklar: new Set(), degerler: new Map() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const [ad, gomulu] = a.split('=');
    const sonraki = gomulu !== undefined ? gomulu : argv[i + 1];
    if (SAYI_BAYRAKLARI[ad]) {
      args.degerler.set(ad, Number(sonraki));
      if (gomulu === undefined) i++;
    } else if (ad === '--config' || ad === '--out') {
      args.degerler.set(ad, sonraki);
      if (gomulu === undefined) i++;
    } else {
      args.bayraklar.add(ad);
    }
  }
  return args;
}

export function loadConfig(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const cfgYol = args.degerler.get('--config') || path.join(ROOT, 'config.json');
  const cfg = derinKopya(JSON.parse(fs.readFileSync(cfgYol, 'utf8')));

  // Ortam degiskenleri
  if (process.env.MONEY_LLM_PROVIDER) cfg.llm.saglayici = process.env.MONEY_LLM_PROVIDER;
  if (process.env.MONEY_LLM_MODEL) cfg.llm.model = process.env.MONEY_LLM_MODEL;
  if (process.env.MONEY_AUDIT_MODEL) cfg.llm.denetciModel = process.env.MONEY_AUDIT_MODEL;
  if (process.env.MONEY_LLM_BASE_URL) cfg.llm.baseUrl = process.env.MONEY_LLM_BASE_URL;
  if (process.env.MONEY_RUN_BUDGET_USD) cfg.akis.runButceUSD = Number(process.env.MONEY_RUN_BUDGET_USD);

  // CLI
  for (const [bayrak, yol] of Object.entries(SAYI_BAYRAKLARI)) {
    const v = args.degerler.get(bayrak);
    if (Number.isFinite(v)) ata(cfg, yol, v);
  }

  cfg.calisma = {
    kuru: args.bayraklar.has('--dry-run') || cfg.llm.saglayici === 'mock',
    zorlaYeni: args.bayraklar.has('--force-new'),
    sessiz: args.bayraklar.has('--quiet'),
    raporYazma: !args.bayraklar.has('--no-write'),
    ciktiYolu: args.degerler.get('--out') || null
  };
  // Kuru calisma gercek defteri kirletmez: ayri dosya, ayri rapor on eki.
  if (cfg.calisma.kuru) {
    cfg.llm.saglayici = 'mock';
    cfg.akis.linkDogrula = false;
  }
  cfg.calisma.defterYolu = path.join(DATA_DIR, cfg.calisma.kuru ? 'ledger.dry.json' : 'ledger.json');
  cfg.calisma.raporOnEk = cfg.calisma.kuru ? 'kuru-' : '';

  dogrula(cfg);
  return cfg;
}

export function dogrula(cfg) {
  const hatalar = [];
  if (!cfg.operator?.beceriler?.length) hatalar.push('operator.beceriler bos');
  if (cfg.llm?.saglayici === 'cursor' && !(cfg.akis.runCagriTavani > 0)) hatalar.push('cursor icin runCagriTavani > 0 olmali');
  if (!cfg.puanlama?.agirliklar) hatalar.push('puanlama.agirliklar yok');
  const toplamAgirlik = Object.values(cfg.puanlama.agirliklar).reduce((a, b) => a + b, 0);
  if (!(toplamAgirlik > 0)) hatalar.push('agirlik toplami 0');
  if (cfg.akis.arastirilacak > cfg.akis.havuzFikir) hatalar.push('arastirilacak > havuzFikir');
  if (cfg.akis.raporaGirenMax > cfg.akis.arastirilacak) hatalar.push('raporaGirenMax > arastirilacak');
  if (!(cfg.akis.runButceUSD > 0)) hatalar.push('runButceUSD > 0 olmali');
  if (hatalar.length) throw new Error('config gecersiz: ' + hatalar.join(', '));
  return true;
}
