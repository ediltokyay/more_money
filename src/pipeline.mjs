/**
 * Boru hatti: KASIF -> on eleme -> ARASTIRMACI -> link dogrulama -> DENETCI -> kod puanlamasi -> defter.
 *
 * Tasarim notu: pahali adim (arastirma+denetim) yalnizca on elemeyi gecen fikirlere uygulanir,
 * boylece run basina maliyet ongorulebilir kalir.
 */
import crypto from 'node:crypto';
import { createLLM, ButceHatasi } from './llm.mjs';
import { kasif, arastirmaci, denetci } from './agents.mjs';
import { linkleriDogrula, urlToplaFromDosya } from './links.mjs';
import { puanla } from './score.mjs';
import { defterYukle, defterKaydet, enYakin, fikirId, hariclar, upsert, wipKapisi, benzerlik, tokenlar, fikirMetni } from './ledger.mjs';

/** Ucuz on-eleme: modelin kendi verdigi sayilardan kaba bir sira. Karar degil, sadece siralama. */
export function onSkor(cfg, f) {
  const o = cfg.operator;
  const gelir = Math.log10(Math.max(10, Number(f.tahminiAylikUSD) || 10)) / 4; // ~0-1
  const hiz = 1 - Math.min(1, (Number(f.ilkParaGun) || 90) / 120);
  const ucuz = (Number(f.kurulumUSD) || 0) <= o.baslangicSermayesiUSD ? 1 : 0.2;
  const gider = (Number(f.aylikGiderUSD) || 0) <= o.aylikSabitGiderTavaniUSD ? 1 : 0.3;
  return Math.round((gelir * 0.35 + hiz * 0.3 + ucuz * 0.2 + gider * 0.15) * 1000) / 1000;
}

async function havuz(isler, esZamanli) {
  const sonuclar = [];
  const kuyruk = isler.map((is, i) => ({ is, i }));
  const isciler = Array.from({ length: Math.max(1, Math.min(esZamanli, isler.length)) }, async () => {
    for (;;) {
      const item = kuyruk.shift();
      if (!item) return;
      sonuclar[item.i] = await item.is();
    }
  });
  await Promise.all(isciler);
  return sonuclar;
}

export async function calistir(cfg, { log = console.log, defterYolu } = {}) {
  const runId = `${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(2).toString('hex')}`;
  const basla = Date.now();
  const defter = defterYukle(defterYolu);
  const kapi = wipKapisi(defter, cfg, cfg.calisma.zorlaYeni);
  const llm = createLLM(cfg, { log });
  const uyarilar = [];

  const butceMetni = llm.saglayici === 'cursor' ? `cagri tavani=${cfg.akis.runCagriTavani}` : `butce=$${cfg.akis.runButceUSD}`;
  log(`# run ${runId} | saglayici=${llm.saglayici} | ${butceMetni}`);
  if (kapi.kilit) {
    log(`! WIP kilidi: ${kapi.acik.length}/${kapi.limit} acik pilot var -> yeni fikir onaya cikmayacak`);
  }

  let ham = [];
  try {
    ham = await kasif(llm, cfg, { hariclar: hariclar(defter), adet: cfg.akis.havuzFikir });
  } catch (e) {
    uyarilar.push(`kasif basarisiz: ${e.message}`);
  }
  log(`kasif: ${ham.length} fikir`);
  if (!ham.length) uyarilar.push('kasif yeni fikir uretmedi; haric listesi tum acilari kapsiyor olabilir');

  // Tekrar filtresi: hem deftere hem de kendi icinde
  const secilenler = [];
  const elenenler = [];
  for (const f of ham) {
    const defterEs = enYakin(defter, f);
    const partiEs = secilenler.reduce((en, s) => {
      const o = benzerlik(tokenlar(fikirMetni(f)), tokenlar(fikirMetni(s)));
      return o > en.oran ? { oran: o, fikir: s } : en;
    }, { oran: 0, fikir: null });
    const es = defterEs.oran >= partiEs.oran ? defterEs : partiEs;
    if (es.oran >= cfg.puanlama.esikler.benzerlikRed) {
      elenenler.push({ fikir: f, sebep: `tekrar (%${Math.round(es.oran * 100)}): ${es.fikir?.baslik}`, benzerlik: es.oran });
      continue;
    }
    secilenler.push({ ...f, _benzerlik: es.oran });
  }
  log(`tekrar filtresi: ${elenenler.length} elendi, ${secilenler.length} kaldi`);

  const kisaListe = secilenler
    .map((f) => ({ f, on: onSkor(cfg, f) }))
    .sort((a, b) => b.on - a.on)
    .slice(0, cfg.akis.arastirilacak)
    .map((x) => x.f);
  log(`on eleme: ${kisaListe.length} fikir derin arastirmaya girecek`);

  const degerlendirmeler = [];
  try {
    const sonuclar = await havuz(
      kisaListe.map((f) => async () => {
        try {
          const dosya = await arastirmaci(llm, cfg, f);
          const linkRaporu = await linkleriDogrula(urlToplaFromDosya(dosya), {
            timeoutMs: cfg.akis.linkTimeoutMs,
            esZamanli: cfg.akis.esZamanli,
            aktif: cfg.akis.linkDogrula
          });
          const denetim = await denetci(llm, cfg, dosya, linkRaporu);
          const puan = puanla(cfg, { fikir: f, dosya, denetim, linkRaporu, benzerlik: f._benzerlik || 0 });
          log(`  - ${f.baslik.slice(0, 60)} -> ${puan.skor} (${puan.durum})`);
          return { fikir: f, dosya, denetim, linkRaporu, puan };
        } catch (e) {
          if (e instanceof ButceHatasi) throw e;
          uyarilar.push(`"${f.baslik}" degerlendirilemedi: ${e.message}`);
          return null;
        }
      }),
      cfg.akis.esZamanli
    );
    degerlendirmeler.push(...sonuclar.filter(Boolean));
  } catch (e) {
    if (!(e instanceof ButceHatasi)) throw e;
    uyarilar.push(`butce doldu, run kisaldi: ${e.message}`);
  }

  degerlendirmeler.sort((a, b) => b.puan.skor - a.puan.skor);

  for (const d of degerlendirmeler) {
    const durum = kapi.kilit && d.puan.durum === 'onayli' ? 'izlemede' : d.puan.durum;
    upsert(defter, {
      id: fikirId(d.fikir),
      baslik: d.fikir.baslik,
      tekCumle: d.fikir.tekCumle,
      etiketler: d.fikir.etiketler || [],
      durum,
      skor: d.puan.skor,
      temelSkor: d.puan.temelSkor,
      altSkorlar: d.puan.altSkorlar,
      cezalar: d.puan.cezalar,
      kirmiziBayraklar: d.puan.kirmiziBayraklar,
      netAy12USD: d.denetim?.duzeltilmisNetAy12USD ?? d.dosya?.netAy12USD ?? null,
      ilkParaGun: d.denetim?.duzeltilmisIlkParaGun ?? d.dosya?.gerceklesme?.ilkParaGun ?? null,
      ilkUcAdim: d.dosya?.ilkUcAdim || [],
      olumKriteri: d.dosya?.olumKriteri || null,
      kaynaklar: (d.linkRaporu?.detay || []).map((x) => ({ url: x.url, ok: x.ok, kod: x.kod })),
      runId
    });
  }

  for (const e of elenenler) {
    const mevcut = defter.fikirler.find((f) => f.id === fikirId(e.fikir));
    if (mevcut) {
      mevcut.tekrarSayaci = (mevcut.tekrarSayaci || 0) + 1;
      mevcut.guncellendi = new Date().toISOString();
    }
  }

  const kazanan = degerlendirmeler.find((d) => (kapi.kilit ? false : d.puan.durum === 'onayli')) || null;

  defter.runlar.push({
    id: runId,
    tarih: new Date().toISOString(),
    saglayici: llm.saglayici,
    model: cfg.llm.model,
    uretilenFikir: ham.length,
    arastirilan: degerlendirmeler.length,
    maliyetUSD: Math.round(llm.kullanim.usd * 10000) / 10000,
    saniye: Math.round((Date.now() - basla) / 1000)
  });

  return {
    runId,
    defter,
    kapi,
    ham,
    elenenler,
    degerlendirmeler,
    kazanan,
    uyarilar,
    kullanim: llm.kullanim,
    saglayici: llm.saglayici,
    saniye: Math.round((Date.now() - basla) / 1000)
  };
}

export { defterKaydet };
