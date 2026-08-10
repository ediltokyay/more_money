/**
 * Fikir defteri: kalici hafiza + tekrar filtresi + WIP kapisi.
 *
 * Bu dosya sistemin en onemli parcasi. Fikir uretmek kolaydir; ayni fikri her hafta
 * yeniden kesfetmemek ve bitmemis is varken yenisine atlamamak zordur.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR } from './config.mjs';

export const DEFTER_YOLU = path.join(DATA_DIR, 'ledger.json');

/** WIP sayilan durumlar: bunlar acikken yeni fikir onaya cikmaz. */
export const ACIK_DURUMLAR = ['pilot'];
export const TUM_DURUMLAR = ['onayli', 'izlemede', 'elendi', 'red', 'pilot', 'canli', 'olduruldu'];

const DURAK = new Set(
  `ve veya ile icin gibi daha cok az bir bu su o de da ki mi mu ne den dan nin nun uzerine
   the a an and or for with to of in on at is are be by from that this it as your you
   ai yapay zeka app uygulama site web online para kazanc gelir is proje sistem`
    .split(/\s+/)
    .filter(Boolean)
);

/**
 * Turkce eklemeli dil: "sahipleri" ve "sahiplerine" ayni koke gider.
 * Kaba on-ek govdesi (6 harf) tekrar yakalamak icin yeterli, sozluk gerektirmez.
 */
export function tokenlar(metin) {
  return new Set(
    String(metin || '')
      .toLocaleLowerCase('tr')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !DURAK.has(t))
      .map((t) => (t.length > 6 ? t.slice(0, 6) : t))
  );
}

/** Jaccard benzerligi (0-1). Tekrar fikir yakalamak icin yeterince ucuz ve yeterince iyi. */
export function benzerlik(a, b) {
  const A = a instanceof Set ? a : tokenlar(a);
  const B = b instanceof Set ? b : tokenlar(b);
  if (!A.size || !B.size) return 0;
  let kesisim = 0;
  for (const t of A) if (B.has(t)) kesisim++;
  return kesisim / (A.size + B.size - kesisim);
}

export function fikirMetni(f) {
  return `${f.baslik || ''} ${f.tekCumle || ''} ${(f.etiketler || []).join(' ')}`;
}

/** Defterdeki en yakin fikir + benzerlik orani. */
export function enYakin(defter, fikir) {
  const T = tokenlar(fikirMetni(fikir));
  let enIyi = { oran: 0, fikir: null };
  for (const kayit of defter.fikirler) {
    const oran = benzerlik(T, tokenlar(fikirMetni(kayit)));
    if (oran > enIyi.oran) enIyi = { oran, fikir: kayit };
  }
  return enIyi;
}

export function fikirId(fikir) {
  const slug = String(fikir.baslik || 'fikir')
    .toLocaleLowerCase('tr')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const ozet = crypto.createHash('sha1').update([...tokenlar(fikirMetni(fikir))].sort().join(' ')).digest('hex').slice(0, 6);
  return `${slug || 'fikir'}-${ozet}`;
}

export function bosDefter() {
  return { surum: 1, guncelleme: null, fikirler: [], runlar: [] };
}

export function defterYukle(yol = DEFTER_YOLU) {
  if (!fs.existsSync(yol)) return bosDefter();
  const d = JSON.parse(fs.readFileSync(yol, 'utf8'));
  d.fikirler ||= [];
  d.runlar ||= [];
  return d;
}

export function defterKaydet(defter, yol = DEFTER_YOLU) {
  defter.guncelleme = new Date().toISOString();
  fs.mkdirSync(path.dirname(yol), { recursive: true });
  fs.writeFileSync(yol, JSON.stringify(defter, null, 2) + '\n', 'utf8');
  return yol;
}

export function acikIsler(defter) {
  return defter.fikirler.filter((f) => ACIK_DURUMLAR.includes(f.durum));
}

/**
 * WIP kapisi: acik pilot sayisi limite ulastiysa yeni fikir ONAYA cikamaz.
 * Arastirma yine yapilir (defter buyur), ama rapor "once sunu bitir" der.
 */
export function wipKapisi(defter, cfg, zorla = false) {
  const acik = acikIsler(defter);
  const kilit = !zorla && acik.length >= cfg.akis.wipLimiti;
  return { kilit, acik, limit: cfg.akis.wipLimiti };
}

/** Hariclar: kasife "bunlari tekrar etme" diye verilecek baslik listesi. */
export function hariclar(defter, adet = 60) {
  return defter.fikirler
    .slice()
    .sort((a, b) => String(b.guncellendi).localeCompare(String(a.guncellendi)))
    .slice(0, adet)
    .map((f) => `${f.baslik} [${f.durum}${Number.isFinite(f.skor) ? ' ' + f.skor : ''}]`);
}

export function upsert(defter, kayit) {
  const simdi = new Date().toISOString();
  const mevcut = defter.fikirler.find((f) => f.id === kayit.id);
  if (!mevcut) {
    const yeni = {
      ...kayit,
      olusturuldu: simdi,
      guncellendi: simdi,
      gecmis: [{ tarih: simdi, durum: kayit.durum, skor: kayit.skor, not: 'ilk degerlendirme' }]
    };
    defter.fikirler.push(yeni);
    return { kayit: yeni, yeniMi: true };
  }
  const durumDegisti = mevcut.durum !== kayit.durum || mevcut.skor !== kayit.skor;
  // Insanin elle koydugu durumlari (pilot/canli/olduruldu) otomatik ezme.
  const elleKilit = ['pilot', 'canli', 'olduruldu'].includes(mevcut.durum);
  Object.assign(mevcut, kayit, { durum: elleKilit ? mevcut.durum : kayit.durum, olusturuldu: mevcut.olusturuldu, guncellendi: simdi });
  mevcut.gecmis ||= [];
  if (durumDegisti) mevcut.gecmis.push({ tarih: simdi, durum: mevcut.durum, skor: kayit.skor, not: 'yeniden degerlendirildi' });
  return { kayit: mevcut, yeniMi: false };
}
