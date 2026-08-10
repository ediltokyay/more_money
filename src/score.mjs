/**
 * Deterministik puanlama. Model sadece 0-5 alt-olcu verir; agirlikli skor + cezalar burada,
 * kodda hesaplanir. Ayni girdi -> ayni skor. Modelin "bence 92" demesi hicbir seyi degistirmez.
 */

export const OLCULER = ['otonomi', 'uygunluk', 'kanit', 'ilkParaHizi', 'netKazanc', 'maliyet', 'risk', 'dayaniklilik'];

const kis = (v, alt, ust) => Math.max(alt, Math.min(ust, v));

function puanAl(altSkorlar, ad) {
  const h = altSkorlar?.[ad];
  const p = typeof h === 'number' ? h : Number(h?.puan);
  return Number.isFinite(p) ? kis(p, 0, 5) : 0;
}

/**
 * Link raporu kanit puanina TAVAN koyar. Model "kanit: 5" dese bile calisan link yoksa gecmez.
 */
export function kanitTavani(linkRaporu) {
  if (!linkRaporu || linkRaporu.kontrolEdildi === false) return 5;
  const toplam = linkRaporu.toplam || 0;
  const calisan = linkRaporu.calisan || 0;
  if (toplam === 0) return 1;
  const oran = calisan / toplam;
  if (calisan === 0) return 1;
  if (oran < 0.5) return 2;
  if (oran < 0.8) return 3;
  if (calisan < 2) return 3;
  return 5;
}

export function puanla(cfg, { fikir = {}, dosya, denetim, linkRaporu, benzerlik = 0 }) {
  const { agirliklar, cezalar, esikler } = cfg.puanlama;
  const o = cfg.operator;

  const yasak = denetim?.yasakIhlali && denetim.yasakIhlali !== 'null' ? String(denetim.yasakIhlali) : null;
  if (yasak || denetim?.karar === 'red') {
    return {
      skor: 0,
      temelSkor: 0,
      durum: 'red',
      altSkorlar: {},
      cezalar: yasak ? [{ ad: 'yasakKategori', puan: 0, neden: `yasak kategori: ${yasak}` }] : [],
      notlar: [denetim?.ozet].filter(Boolean),
      redSebebi: yasak ? `yasak kategori: ${yasak}` : 'denetci reddetti'
    };
  }

  const alt = {};
  for (const ad of OLCULER) alt[ad] = puanAl(denetim?.altSkorlar, ad);
  const tavan = kanitTavani(linkRaporu);
  if (alt.kanit > tavan) alt.kanit = tavan;

  let agirlikToplam = 0;
  let carpimToplam = 0;
  for (const ad of OLCULER) {
    const w = agirliklar[ad] ?? 0;
    agirlikToplam += w;
    carpimToplam += w * alt[ad];
  }
  const temelSkor = agirlikToplam > 0 ? (100 * carpimToplam) / (5 * agirlikToplam) : 0;

  const uygulanan = [];
  const ekle = (ad, puan, neden) => {
    if (puan > 0) uygulanan.push({ ad, puan: Math.round(puan * 10) / 10, neden });
  };

  const kanitsiz = (denetim?.kanitsizIddialar || []).length;
  ekle(
    'kanitsizIddia',
    Math.min(kanitsiz * cezalar.kanitsizIddiaBasina, cezalar.kanitsizIddiaTavani),
    `${kanitsiz} kanitsiz sayisal iddia`
  );

  if (linkRaporu?.kontrolEdildi) {
    const olu = (linkRaporu.toplam || 0) - (linkRaporu.calisan || 0);
    ekle('olusuzLink', Math.min(olu * cezalar.olusuzLinkBasina, cezalar.olusuzLinkTavani), `${olu} link acilmadi/uydurma`);
    if ((linkRaporu.toplam || 0) === 0) ekle('kanitYok', cezalar.kanitYok, 'hic kaynak linki verilmemis');
  }

  const kurulum = Number(dosya?.kurulumUSD ?? fikir?.kurulumUSD);
  const kurulumUSD = Number.isFinite(kurulum) ? kurulum : 0;
  if (kurulumUSD > o.baslangicSermayesiUSD) {
    ekle('sermayeAsimi', cezalar.sermayeAsimi, `kurulum $${kurulumUSD} > sermaye $${o.baslangicSermayesiUSD}`);
  }

  const aylik = Number(dosya?.birimEkonomi?.aylikSabitUSD);
  if (Number.isFinite(aylik) && aylik > o.aylikSabitGiderTavaniUSD) {
    ekle('giderAsimi', cezalar.giderAsimi, `aylik gider $${aylik} > tavan $${o.aylikSabitGiderTavaniUSD}`);
  }

  if (dosya?.otonomi?.gunlukMudahaleGerekiyor === true) {
    ekle('gunlukMudahale', cezalar.gunlukMudahale, 'gunluk insan mudahalesi sart');
  }

  const gun = Number(denetim?.duzeltilmisIlkParaGun ?? dosya?.gerceklesme?.ilkParaGun);
  if (Number.isFinite(gun) && gun > esikler.ilkParaGunTavani) {
    ekle('yavasIlkPara', cezalar.yavasIlkPara, `ilk para ${gun} gun > ${esikler.ilkParaGunTavani}`);
  }

  if (benzerlik >= esikler.benzerlikRed) {
    ekle('benzerFikir', cezalar.benzerFikir, `defterdeki bir fikirle %${Math.round(benzerlik * 100)} benzer`);
  }

  const cezaToplam = uygulanan.reduce((a, c) => a + c.puan, 0);
  const skor = Math.round(kis(temelSkor - cezaToplam, 0, 100) * 10) / 10;

  // "sartli" karar tek basina onaya yetmez: esik + temiz denetim ikisi birden gerekir.
  let durum = 'elendi';
  if (skor >= esikler.izleme) durum = 'izlemede';
  if (skor >= esikler.onay && denetim?.karar === 'kabul') durum = 'onayli';

  return {
    skor,
    temelSkor: Math.round(temelSkor * 10) / 10,
    durum,
    altSkorlar: alt,
    altGerekceler: Object.fromEntries(OLCULER.map((ad) => [ad, denetim?.altSkorlar?.[ad]?.gerekce || ''])),
    cezalar: uygulanan,
    notlar: [denetim?.ozet].filter(Boolean),
    kirmiziBayraklar: denetim?.kirmiziBayraklar || []
  };
}
