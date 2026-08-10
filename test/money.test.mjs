/**
 * node --test test/money.test.mjs
 * Aginternet erisimi gerektirmez; tumu fixture/mock uzerinden calisir.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
import { loadConfig, dogrula } from '../src/config.mjs';
import { createLLM, ButceHatasi } from '../src/llm.mjs';
import { komutKur, komutParcala, modBul } from '../src/cursor-cli.mjs';
import { denetci, kasif } from '../src/agents.mjs';
import { puanla, kanitTavani, OLCULER } from '../src/score.mjs';
import { benzerlik, tokenlar, fikirId, upsert, bosDefter, wipKapisi, hariclar } from '../src/ledger.mjs';
import { jsonCikar } from '../src/llm.mjs';
import { kasifSema, arastirmaciSema, denetciSema } from '../src/agents.mjs';
import { urlToplaFromDosya, linkleriDogrula } from '../src/links.mjs';
import { calistir, onSkor } from '../src/pipeline.mjs';
import { raporUret } from '../src/report.mjs';

const cfg = () => loadConfig(['--dry-run']);

const tamAltSkor = (p) => Object.fromEntries(OLCULER.map((o) => [o, { puan: p, gerekce: 'test' }]));

const denetimSablon = (over = {}) => ({
  karar: 'kabul',
  yasakIhlali: null,
  kanitsizIddialar: [],
  kirmiziBayraklar: [],
  altSkorlar: tamAltSkor(4),
  ...over
});

const dosyaSablon = (over = {}) => ({
  baslik: 'test',
  birimEkonomi: { fiyatUSD: 20, musteriBasinaMaliyetUSD: 1, aylikSabitUSD: 5, basaBasMusteri: 1 },
  gerceklesme: { ilkParaGun: 20, gerekliHesaplar: [], yasalGereklilik: '' },
  ilkUcAdim: [{ adim: 'a', kimYapar: 'ajan', sure: '1g' }],
  otonomi: { ajanYapabilir: ['kod'], insanSart: [], gunlukMudahaleGerekiyor: false },
  olumKriteri: '6 hafta 3 musteri',
  kurulumUSD: 10,
  netAy12USD: 500,
  ...over
});

test('config: gecersiz akis kombinasyonu reddedilir', () => {
  const c = cfg();
  c.akis.arastirilacak = c.akis.havuzFikir + 1;
  assert.throws(() => dogrula(c), /arastirilacak/);
});

test('puanlama deterministik ve agirlikli', () => {
  const c = cfg();
  const a = puanla(c, { dosya: dosyaSablon(), denetim: denetimSablon(), linkRaporu: null });
  const b = puanla(c, { dosya: dosyaSablon(), denetim: denetimSablon(), linkRaporu: null });
  assert.equal(a.skor, b.skor);
  assert.equal(a.skor, 80); // her olcu 4/5 -> %80, ceza yok
  assert.equal(a.durum, 'onayli');
});

test('yasak kategori sert red: skor 0', () => {
  const c = cfg();
  const p = puanla(c, {
    dosya: dosyaSablon(),
    denetim: denetimSablon({ altSkorlar: tamAltSkor(5), yasakIhlali: 'kumar, bahis, sans oyunu' }),
    linkRaporu: null
  });
  assert.equal(p.skor, 0);
  assert.equal(p.durum, 'red');
  assert.match(p.redSebebi, /kumar/);
});

test('sartli karar tek basina onaya yetmez', () => {
  const c = cfg();
  const p = puanla(c, { dosya: dosyaSablon(), denetim: denetimSablon({ karar: 'sartli' }), linkRaporu: null });
  assert.ok(p.skor >= c.puanlama.esikler.onay);
  assert.equal(p.durum, 'izlemede');
});

test('olu linkler kanit puanina tavan koyar ve ceza yazar', () => {
  const c = cfg();
  const linkRaporu = { kontrolEdildi: true, toplam: 3, calisan: 0, detay: [] };
  const p = puanla(c, { dosya: dosyaSablon(), denetim: denetimSablon({ altSkorlar: tamAltSkor(5) }), linkRaporu });
  assert.equal(p.altSkorlar.kanit, 1, 'kanit tavani uygulanmali');
  assert.ok(p.cezalar.some((x) => x.ad === 'olusuzLink'));
  assert.ok(p.skor < 80);
});

test('kanitTavani esikleri', () => {
  assert.equal(kanitTavani(null), 5);
  assert.equal(kanitTavani({ kontrolEdildi: true, toplam: 0, calisan: 0 }), 1);
  assert.equal(kanitTavani({ kontrolEdildi: true, toplam: 4, calisan: 1 }), 2);
  assert.equal(kanitTavani({ kontrolEdildi: true, toplam: 4, calisan: 3 }), 3);
  assert.equal(kanitTavani({ kontrolEdildi: true, toplam: 4, calisan: 4 }), 5);
});

test('sermaye ve gider asimi cezalari', () => {
  const c = cfg();
  const p = puanla(c, {
    fikir: { kurulumUSD: 5000 },
    dosya: dosyaSablon({ kurulumUSD: null, birimEkonomi: { aylikSabitUSD: 500 } }),
    denetim: denetimSablon(),
    linkRaporu: null
  });
  const adlar = p.cezalar.map((x) => x.ad);
  assert.ok(adlar.includes('sermayeAsimi'));
  assert.ok(adlar.includes('giderAsimi'));
});

test('gunluk mudahale ve yavas ilk para cezalanir', () => {
  const c = cfg();
  const p = puanla(c, {
    dosya: dosyaSablon({
      otonomi: { gunlukMudahaleGerekiyor: true },
      gerceklesme: { ilkParaGun: 200 }
    }),
    denetim: denetimSablon({ duzeltilmisIlkParaGun: 200 }),
    linkRaporu: null
  });
  const adlar = p.cezalar.map((x) => x.ad);
  assert.ok(adlar.includes('gunlukMudahale'));
  assert.ok(adlar.includes('yavasIlkPara'));
});

test('benzerlik: ayni fikir yuksek, farkli fikir dusuk', () => {
  const a = 'Metin2 server sahiplerine 3D item onizleme paneli aboneligi';
  const b = 'Metin2 server sahipleri icin 3D item onizleme paneli aboneligi';
  const cc = 'Koltuk yikama isletmelerine musteri hatirlatma botu';
  assert.ok(benzerlik(a, b) > 0.8, `benzerlik dusuk: ${benzerlik(a, b)}`);
  assert.ok(benzerlik(a, cc) < 0.2);
  assert.ok(tokenlar('ve ile bir AI app').size === 0, 'durak kelimeler elenmeli');
});

test('fikirId kararli ve kelime sirasindan bagimsiz', () => {
  const a = fikirId({ baslik: 'Panel abonelik', tekCumle: 'x y z', etiketler: ['a'] });
  const b = fikirId({ baslik: 'Panel abonelik', tekCumle: 'z y x', etiketler: ['a'] });
  assert.equal(a, b);
  assert.notEqual(a, fikirId({ baslik: 'Baska fikir', tekCumle: 'q w e' }));
});

test('defter: upsert insan durumunu ezmez', () => {
  const d = bosDefter();
  upsert(d, { id: 'x', baslik: 'A', durum: 'onayli', skor: 71 });
  d.fikirler[0].durum = 'pilot';
  upsert(d, { id: 'x', baslik: 'A', durum: 'elendi', skor: 20 });
  assert.equal(d.fikirler[0].durum, 'pilot');
  assert.equal(d.fikirler[0].skor, 20);
  assert.equal(d.fikirler.length, 1);
});

test('WIP kapisi acik pilotta kilitlenir, --force-new acar', () => {
  const c = cfg();
  const d = bosDefter();
  upsert(d, { id: 'x', baslik: 'A', durum: 'pilot', skor: 80 });
  assert.equal(wipKapisi(d, c).kilit, true);
  assert.equal(wipKapisi(d, c, true).kilit, false);
  upsert(d, { id: 'y', baslik: 'B', durum: 'canli', skor: 80 });
  assert.equal(wipKapisi(d, c).acik.length, 1, 'canli WIP saymaz');
});

test('hariclar defter basliklarini kasife tasir', () => {
  const d = bosDefter();
  upsert(d, { id: 'x', baslik: 'A fikri', durum: 'elendi', skor: 12 });
  assert.match(hariclar(d)[0], /A fikri \[elendi 12\]/);
});

test('jsonCikar: kod citi ve gevezelik toleransli', () => {
  assert.deepEqual(jsonCikar('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(jsonCikar('Iste cevap: {"a":[1,2]} umarim yardimci olur'), { a: [1, 2] });
  assert.throws(() => jsonCikar('json yok'), /JSON/);
});

test('sema dogrulayicilar eksik alani yakalar', () => {
  assert.match(kasifSema({}), /fikirler dizisi yok/);
  assert.equal(kasifSema({ fikirler: [] }), null, 'bos liste gecerli cevap');
  assert.match(kasifSema({ fikirler: [{ baslik: 'a' }] }), /tekCumle/);
  assert.equal(kasifSema({ fikirler: [{ baslik: 'a', tekCumle: 'b' }] }), null);
  assert.match(arastirmaciSema({ baslik: 'a', ilkUcAdim: [1], otonomi: {} }), /olumKriteri/);
  assert.match(denetciSema({ karar: 'evet' }), /karar/);
  assert.match(denetciSema({ karar: 'kabul', altSkorlar: { otonomi: { puan: 3 } } }), /altSkor eksik/);
  assert.equal(denetciSema({ karar: 'kabul', altSkorlar: tamAltSkor(3) }), null);
});

test('link toplama ve kapali dogrulama', async () => {
  const urls = urlToplaFromDosya({
    pazarKaniti: [{ kaynakUrl: 'https://a.com/x' }, { kaynakUrl: null }],
    rakipler: [{ url: 'https://a.com/x' }, { url: 'https://b.com' }]
  });
  assert.deepEqual(urls, ['https://a.com/x', 'https://b.com']);
  const r = await linkleriDogrula(urls, { aktif: false });
  assert.equal(r.kontrolEdildi, false);
});

test('link dogrulama sahte/gecersiz URL yakalar (ag yok)', async () => {
  const r = await linkleriDogrula(['https://example.com/kaynak', 'not-a-url'], { aktif: true, timeoutMs: 1000 });
  assert.equal(r.kontrolEdildi, true);
  assert.equal(r.calisan, 0);
  assert.equal(r.detay.length, 2);
});

test('onSkor pahali ve yavas fikri asagi ceker', () => {
  const c = cfg();
  const iyi = onSkor(c, { tahminiAylikUSD: 500, ilkParaGun: 14, kurulumUSD: 10, aylikGiderUSD: 5 });
  const kotu = onSkor(c, { tahminiAylikUSD: 500, ilkParaGun: 120, kurulumUSD: 5000, aylikGiderUSD: 400 });
  assert.ok(iyi > kotu);
});

test('uctan uca kuru run: rapor + defter + kapilar', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'money-'));
  const defterYolu = path.join(tmp, 'ledger.json');
  const c = cfg();
  c.calisma.raporYazma = false;

  const s = await calistir(c, { log: () => {}, defterYolu });
  assert.ok(s.degerlendirmeler.length >= 2, 'en az iki fikir degerlendirilmeli');
  assert.ok(s.degerlendirmeler.every((d, i, a) => i === 0 || a[i - 1].puan.skor >= d.puan.skor), 'skora gore sirali');

  const yasakli = s.degerlendirmeler.find((d) => /airdrop/i.test(d.fikir.baslik));
  if (yasakli) assert.equal(yasakli.puan.durum, 'red');

  assert.ok(s.kazanan, 'kuru run bir kazanan uretmeli');
  assert.ok(s.kazanan.puan.skor >= c.puanlama.esikler.onay);

  const md = raporUret(c, s);
  assert.match(md, /## Bu haftanin tek isi/);
  assert.match(md, /KURU CALISMA/);
  assert.match(md, new RegExp(s.kazanan.fikir.baslik.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  // Ikinci run: ayni fikirler tekrar filtresine takilmali
  const { defterKaydet } = await import('../src/ledger.mjs');
  defterKaydet(s.defter, defterYolu);
  const s2 = await calistir(c, { log: () => {}, defterYolu });
  assert.ok(s2.ham.length < s.ham.length || s2.elenenler.length > 0, 'tekrar filtresi calismali');

  fs.rmSync(tmp, { recursive: true, force: true });
});

// ---- Cursor CLI saglayicisi ----

const SAHTE_AJAN = `${process.execPath} ${fileURLToPath(new URL('./fake-agent.mjs', import.meta.url))}`;

function cursorCfg(over = {}) {
  const c = loadConfig([]);
  c.llm.saglayici = 'cursor';
  c.llm.cursor = { komut: SAHTE_AJAN, mod: 'argv', timeoutMs: 30000, ekBayraklar: ['--trust', '-f'], ...over };
  c.calisma = { ...(c.calisma || {}), kuru: false };
  return c;
}

test('config varsayilani: arastirma composer, denetim grok', () => {
  const c = loadConfig([]);
  assert.equal(c.llm.saglayici, 'cursor');
  assert.equal(c.llm.model, 'composer-2.5');
  assert.equal(c.llm.denetciModel, 'cursor-grok-4.5-high');
});

test('komutParcala ve komutKur argv/stdin/ps1 sekilleri', () => {
  assert.deepEqual(komutParcala('node fake.mjs'), { cmd: 'node', onEkArgs: ['fake.mjs'] });

  const argvPlan = komutKur({ komut: 'agent', model: 'composer-2.5', prompt: 'selam', ekBayraklar: ['--trust', '-f'], mod: 'argv' });
  assert.equal(argvPlan.cmd, 'agent');
  assert.deepEqual(argvPlan.args, ['-p', '--trust', '-f', '--model', 'composer-2.5', '--output-format', 'text', '--', 'selam']);
  assert.equal(argvPlan.stdinMi, false);

  const dashPlan = komutKur({ komut: 'agent', model: 'm', prompt: '-14 dB stem', ekBayraklar: ['--trust', '-f'], mod: 'argv' });
  assert.ok(dashPlan.args.includes('--'));
  assert.equal(dashPlan.args.at(-1), '-14 dB stem', 'eksi ile baslayan prompt bayrak olmamali');

  const stdinPlan = komutKur({ komut: 'agent', model: 'm', prompt: 'uzun', mod: 'stdin' });
  assert.equal(stdinPlan.stdinMi, true);
  assert.ok(!stdinPlan.args.includes('uzun'), 'stdin modunda prompt argv de olmamali');

  const psPlan = komutKur({ komut: 'agent', model: 'm', prompt: 'x', mod: 'ps1', promptDosyasi: 'C:\\tmp\\p.txt' });
  assert.equal(psPlan.cmd, 'powershell.exe');
  assert.ok(psPlan.args.includes('C:\\tmp\\p.txt'));
  assert.ok(!psPlan.args.includes('x'), 'ps1 modunda prompt komut satirinda olmamali');
});

test('modBul: windows stdin (argv kirlenmesin), digerleri argv', () => {
  assert.equal(modBul({ mod: 'stdin' }), 'stdin');
  assert.equal(modBul({ mod: 'ps1' }), 'ps1');
  assert.equal(modBul({ mod: 'oto' }), process.platform === 'win32' ? 'stdin' : 'argv');
});

test('eksi ile baslayan prompt stdin ile guvenle tasinir', async () => {
  const c = cursorCfg({ mod: 'stdin' });
  const llm = createLLM(c, { log: () => {} });
  const v = await llm.json({
    etiket: 'test',
    system: 'S',
    user: 'olcum: -14 dB stem paketi',
    model: 'composer-2.5'
  });
  assert.equal(v.ok, true);
  assert.equal(v.mod, 'stdin');
});

test('cursor saglayicisi: CLI cagrilir, model gecer, dolar yazilmaz', async () => {
  const c = cursorCfg();
  const llm = createLLM(c, { log: () => {} });
  const v = await llm.json({ etiket: 'test', system: 'S', user: 'U', model: 'composer-2.5' });
  assert.equal(v.ok, true);
  assert.equal(v.model, 'composer-2.5');
  assert.equal(llm.kullanim.cagri, 1);
  assert.equal(llm.kullanim.usd, 0, 'Cursor havuzunda dolar maliyeti yazilmamali');
  assert.ok(v.bayraklar.includes('--trust'));
});

test('cursor saglayicisi stdin modu prompt`u tasir', async () => {
  const c = cursorCfg({ mod: 'stdin' });
  const llm = createLLM(c, { log: () => {} });
  const v = await llm.json({ etiket: 'test', system: 'SISTEM', user: 'KULLANICI', model: 'composer-2.5' });
  assert.equal(v.mod, 'stdin');
  assert.ok(v.promptUzunluk > 10);
});

test('cursor saglayicisinda butce cagri adediyle sinirlanir', async () => {
  const c = cursorCfg();
  c.akis.runCagriTavani = 1;
  const llm = createLLM(c, { log: () => {} });
  await llm.json({ etiket: 'bir', system: 'S', user: 'U', model: 'm' });
  await assert.rejects(() => llm.json({ etiket: 'iki', system: 'S', user: 'U', model: 'm' }), ButceHatasi);
});

test('roller dogru modele gider: kasif varsayilan, denetci denetciModel', async () => {
  const c = loadConfig([]);
  const gorulen = [];
  const sahteLLM = {
    json: async (a) => {
      gorulen.push(a.model);
      return a.etiket.startsWith('denetim')
        ? { karar: 'kabul', altSkorlar: tamAltSkor(3) }
        : { fikirler: [{ baslik: 'a', tekCumle: 'b' }] };
    }
  };
  await kasif(sahteLLM, c, { hariclar: [], adet: 1 });
  await denetci(sahteLLM, c, { baslik: 'x' }, null);
  assert.equal(gorulen[0], undefined, 'kasif model override etmez, istemci varsayilanini kullanir');
  assert.equal(gorulen[1], 'cursor-grok-4.5-high');
});

test('operator profili kisisel projeye baglanmaz', async () => {
  const c = loadConfig([]);
  const { operatorKarti } = await import('../src/prompts.mjs');
  const kart = operatorKarti(c);
  assert.match(kart, /Beceriler/);
  assert.match(kart, /baglamaya CALISMA/, 'mevcutIsler bosken zorlama baglanti yasaklanmali');
  assert.ok(!/savasci|metin2|koltuk/i.test(kart), 'profilde kisisel proje adi olmamali');
});

test('WIP kilidi raporu "once bunu bitir" moduna alir', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'money-wip-'));
  const defterYolu = path.join(tmp, 'ledger.json');
  const c = cfg();
  c.calisma.raporYazma = false;

  const { defterKaydet, bosDefter: bd, upsert: up } = await import('../src/ledger.mjs');
  const d = bd();
  up(d, { id: 'acik-is', baslik: 'Yarim kalan pilot', durum: 'pilot', skor: 75, olumKriteri: '4 hafta 2 musteri' });
  defterKaydet(d, defterYolu);

  const s = await calistir(c, { log: () => {}, defterYolu });
  assert.equal(s.kapi.kilit, true);
  assert.equal(s.kazanan, null, 'kilitliyken yeni kazanan olmamali');
  assert.ok(s.defter.fikirler.every((f) => f.durum !== 'onayli'), 'kilitliyken onayli uretilmemeli');
  assert.match(raporUret(c, s), /Once bunu bitir/i);

  fs.rmSync(tmp, { recursive: true, force: true });
});
