/**
 * Offline fixture saglayici: API anahtari olmadan tum boru hattini calistirir.
 *
 * Amaci demo degil, TEST: kapilarin (yasak kategori reddi, tekrar filtresi, WIP kilidi,
 * kanit tavani) gercekten calistigini anahtar harcamadan dogrular. --dry-run bunu kullanir.
 * Fixture fikirleri operator profilinden turetilmis gercek adaylardir; oldugu gibi kullanilmaz,
 * gercek run gercek modelle yapilir.
 */

// Fixture fikirleri kasten notr: belirli bir proje/sektore bagli degil, sadece kapilari test eder.
const FIXTURE_FIKIRLER = [
  {
    baslik: 'Kucuk e-ticaret sitelerine haftalik otomatik teknik saglik raporu',
    tekCumle: 'Siteyi haftada bir tarar, kirik link / yavas sayfa / eksik etiket raporunu e-postayla yollar; aylik abonelik.',
    nedenUygun: 'Web tarama ve rapor uretimi Node ile yazilabilir; arayuz gerektirmez',
    musteri: 'Aylik 10-200 siparis alan kucuk magazalar',
    gelirModeli: 'abonelik',
    tahminiAylikUSD: 400,
    ilkParaGun: 21,
    kurulumUSD: 12,
    aylikGiderUSD: 8,
    otonomiNotu: 'Tarama, rapor ve fatura cron ile; insan sadece ilk kurulumu yapar',
    etiketler: ['saas', 'otomasyon', 'b2b']
  },
  {
    baslik: 'Dosya formati donusturen kredili self-servis API',
    tekCumle: 'Nis bir dosya formatini yaygin formata ceviren, kredi ile calisan API ve web arayuzu.',
    nedenUygun: 'Donusum hattini Node ile kurmak dogrudan beceri kapsaminda',
    musteri: 'Bu formatla calisan kucuk studyolar ve bagimsiz gelistiriciler',
    gelirModeli: 'tek seferlik',
    tahminiAylikUSD: 220,
    ilkParaGun: 30,
    kurulumUSD: 15,
    aylikGiderUSD: 12,
    otonomiNotu: 'Kuyruk + worker; hatali islem otomatik iade',
    etiketler: ['api', 'pipeline']
  },
  {
    baslik: 'Yerel hizmet isletmelerine otomatik musteri geri-donus hatirlatma servisi',
    tekCumle: 'Isletmenin musteri listesine periyodik kisisellestirilmis hatirlatma gonderir, randevuyu takvime yazar.',
    nedenUygun: 'Zamanlanmis mesaj + takvim entegrasyonu standart otomasyon isi',
    musteri: 'Randevuyla calisan kucuk yerel isletmeler (TR)',
    gelirModeli: 'abonelik',
    tahminiAylikUSD: 300,
    ilkParaGun: 14,
    kurulumUSD: 5,
    aylikGiderUSD: 10,
    otonomiNotu: 'Zamanlanmis gonderim + otomatik cevap siniflandirma',
    etiketler: ['yerel', 'saas', 'otomasyon']
  },
  {
    baslik: 'Airdrop farming botu ile pasif kripto geliri',
    tekCumle: 'Coklu cuzdanla airdrop kriterlerini otomatik dolduran bot.',
    nedenUygun: 'Otomasyon bilgisi var',
    musteri: 'Operatorun kendisi',
    gelirModeli: 'spekulasyon',
    tahminiAylikUSD: 1500,
    ilkParaGun: 45,
    kurulumUSD: 200,
    aylikGiderUSD: 40,
    otonomiNotu: 'Bot 7/24 calisir',
    etiketler: ['kripto', 'bot']
  },
  {
    baslik: 'E-ticaret magazalarina haftalik site saglik taramasi aboneligi',
    tekCumle: 'Magaza sitesini haftalik tarar, teknik hata raporunu yollar, aylik ucret alir.',
    nedenUygun: 'Ayni tarama hatti',
    musteri: 'Kucuk online magazalar',
    gelirModeli: 'abonelik',
    tahminiAylikUSD: 380,
    ilkParaGun: 25,
    kurulumUSD: 10,
    aylikGiderUSD: 8,
    otonomiNotu: 'Otomatik',
    etiketler: ['saas', 'otomasyon']
  }
];

const DENETIM_AYARI = {
  'Kucuk e-ticaret sitelerine haftalik otomatik teknik saglik raporu': {
    karar: 'kabul',
    puanlar: { otonomi: 4, uygunluk: 5, kanit: 4, ilkParaHizi: 4, netKazanc: 3, maliyet: 5, risk: 4, dayaniklilik: 4 },
    kanitsiz: ['aylik $400 gelir tahmini kaynaksiz'],
    bayraklar: ['Ucretsiz rakip araclar var; farklilasma tek satirda anlatilabilmeli']
  },
  'Yerel hizmet isletmelerine otomatik musteri geri-donus hatirlatma servisi': {
    karar: 'kabul',
    puanlar: { otonomi: 4, uygunluk: 4, kanit: 3, ilkParaHizi: 5, netKazanc: 3, maliyet: 5, risk: 3, dayaniklilik: 3 },
    kanitsiz: ['%30 geri donus orani iddiasi kaynaksiz'],
    bayraklar: ['Mesaj gonderimi platform kurallarina takilabilir; onayli sablon sart']
  },
  'Dosya formati donusturen kredili self-servis API': {
    karar: 'sartli',
    puanlar: { otonomi: 5, uygunluk: 4, kanit: 2, ilkParaHizi: 3, netKazanc: 2, maliyet: 4, risk: 3, dayaniklilik: 2 },
    kanitsiz: ['talep hacmi icin kaynak yok', 'donusum basina fiyat rakip verisiyle desteklenmemis'],
    bayraklar: ['Ucretsiz acik kaynak donusturucular var; odeme istegi belirsiz']
  },
  'Airdrop farming botu ile pasif kripto geliri': {
    karar: 'red',
    yasakIhlali: 'kripto spekulasyon / token / airdrop',
    puanlar: { otonomi: 3, uygunluk: 1, kanit: 0, ilkParaHizi: 1, netKazanc: 1, maliyet: 1, risk: 0, dayaniklilik: 0 },
    kanitsiz: ['aylik $1500 tamamen uydurma'],
    bayraklar: ['Yasak kategori', 'Sermaye tavanini asiyor']
  }
};

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Isaretten sonraki ILK dengeli JSON nesnesini alir (metinde birden fazla blok olabilir). */
function bolumJson(user, isaret) {
  const i = user.indexOf(isaret);
  if (i === -1) return {};
  const s = user.slice(i + isaret.length);
  const bas = s.indexOf('{');
  if (bas === -1) return {};
  let derinlik = 0;
  let metinde = false;
  let kacis = false;
  for (let k = bas; k < s.length; k++) {
    const c = s[k];
    if (metinde) {
      if (kacis) kacis = false;
      else if (c === '\\') kacis = true;
      else if (c === '"') metinde = false;
      continue;
    }
    if (c === '"') metinde = true;
    else if (c === '{') derinlik++;
    else if (c === '}' && --derinlik === 0) {
      try {
        return JSON.parse(s.slice(bas, k + 1));
      } catch {
        return {};
      }
    }
  }
  return {};
}

function paket(nesne) {
  const metin = JSON.stringify(nesne);
  return { metin, girdiTok: 900, ciktiTok: Math.ceil(metin.length / 4) };
}

export function mockYanit({ system, user }) {
  if (system.includes('KASIF')) {
    const adet = Number((user.match(/(\d+) fikir uret/) || [])[1] || 4);
    const haric = new Set(
      (user.match(/DAHA ONCE DEGERLENDIRILMIS[\s\S]*?(?=\n\n)/) || [''])[0]
        .split('\n')
        .slice(1)
        .map((s) => s.replace(/^- /, '').replace(/\s*\[[^\]]*\]$/, '').trim())
        .filter(Boolean)
    );
    const secilen = FIXTURE_FIKIRLER.filter((f) => !haric.has(f.baslik)).slice(0, adet);
    return paket({ fikirler: secilen });
  }

  if (system.includes('ARASTIRMACI')) {
    const fikir = bolumJson(user, 'INCELENECEK FIKIR:');
    const h = hash(fikir.baslik || 'x');
    const fiyat = 15 + (h % 20);
    return paket({
      baslik: fikir.baslik,
      pazarKaniti: [
        { iddia: `${fikir.musteri} segmentinde odeme aliskanligi var`, kaynakUrl: 'https://trends.google.com/', tahminMi: false },
        { iddia: `Aylik ${fikir.tahminiAylikUSD}$ tahmini`, kaynakUrl: null, tahminMi: true }
      ],
      rakipler: [{ ad: 'benzer kucuk arac', url: 'https://github.com/search?q=site+health+monitor', fiyat: `$${fiyat}/ay` }],
      birimEkonomi: {
        fiyatUSD: fiyat,
        musteriBasinaMaliyetUSD: 1.2,
        aylikSabitUSD: fikir.aylikGiderUSD ?? 10,
        basaBasMusteri: Math.max(1, Math.ceil((fikir.aylikGiderUSD ?? 10) / Math.max(1, fiyat - 1.2)))
      },
      gerceklesme: {
        ilkParaGun: fikir.ilkParaGun ?? 30,
        gerekliHesaplar: ['odeme saglayici (Stripe/Iyzico)', 'alan adi', 'sunucu'],
        yasalGereklilik: 'sahis sirketi veya mevcut isletme uzerinden faturalandirma'
      },
      ilkUcAdim: [
        { adim: 'Tek sayfalik satis sayfasi + odeme linki yayina al', kimYapar: 'ajan', sure: '1 gun' },
        { adim: 'Calisan bir demo/prototip cikar', kimYapar: 'ajan', sure: '3 gun' },
        { adim: 'Hedef toplulukta 20 kisiye demo linki gonder', kimYapar: 'insan', sure: '2 saat' }
      ],
      otonomi: {
        ajanYapabilir: ['kod', 'dagitim', 'fatura', 'destek e-postasi taslagi'],
        insanSart: ['odeme hesabi acilisi', 'ilk tanitim mesaji'],
        gunlukMudahaleGerekiyor: false
      },
      riskler: ['pazar kucuk', 'ilk musteriye ulasmak insan temasi istiyor'],
      olumKriteri: '6 hafta icinde 3 odeyen musteri yoksa oldur',
      kurulumUSD: fikir.kurulumUSD ?? 10,
      netAy12USD: Math.round((fikir.tahminiAylikUSD ?? 100) * 0.45),
      guven: 0.55
    });
  }

  // DENETCI
  const dosya = bolumJson(user, 'ARASTIRMA DOSYASI:');
  const ayar = DENETIM_AYARI[dosya.baslik] || {
    karar: 'sartli',
    puanlar: { otonomi: 3, uygunluk: 3, kanit: 2, ilkParaHizi: 3, netKazanc: 2, maliyet: 3, risk: 3, dayaniklilik: 2 },
    kanitsiz: ['gelir tahmini kaynaksiz'],
    bayraklar: []
  };
  const altSkorlar = Object.fromEntries(
    Object.entries(ayar.puanlar).map(([k, v]) => [k, { puan: v, gerekce: `fixture degerlendirmesi (${k})` }])
  );
  return paket({
    karar: ayar.karar,
    yasakIhlali: ayar.yasakIhlali || null,
    kanitsizIddialar: ayar.kanitsiz,
    kirmiziBayraklar: ayar.bayraklar,
    altSkorlar,
    duzeltilmisNetAy12USD: Math.round((dosya.netAy12USD || 100) * 0.7),
    duzeltilmisIlkParaGun: (dosya.gerceklesme?.ilkParaGun || 30) + 7,
    ozet: 'Fixture denetimi: gercek run icin API anahtari gerekir.'
  });
}
