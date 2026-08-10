/**
 * Ajan promptlari. Uc rol, tek yon: uret -> arastir -> denetle.
 * Kural: puanlamayi model YAPMAZ; model yalnizca 0-5 alt-olcu + gerekce verir,
 * agirlikli skoru kod hesaplar (score.mjs). Boylece "kendi fikrine 95 veren model" sorunu biter.
 */

const JSON_KURALI =
  'YALNIZCA gecerli JSON dondur. Markdown yok, aciklama yok, kod citi yok. Bilmedigin sayiyi uydurma: null yaz.';

export function operatorKarti(cfg) {
  const o = cfg.operator;
  const isler = o.mevcutIsler || [];
  const zorunlu = o.varlikKullanimi === 'zorunlu';
  return [
    `OPERATOR PROFILI`,
    `- Pazarlar: ${o.pazarlar.join(', ')} | Diller: ${o.diller.join(', ')}`,
    `- Beceriler (fikri uygulayabilecegi teknik yetenekler):`,
    ...o.beceriler.map((v) => `    * ${v}`),
    isler.length
      ? `- Mevcut isleri (${zorunlu ? 'fikir bunlardan birine baglanmali' : 'kaldirac olabilir ama ZORUNLU DEGIL'}):\n${isler
          .map((v) => `    * ${v}`)
          .join('\n')}`
      : `- Mevcut is/varlik listesi bos: fikri bir projeye ya da sektore baglamaya CALISMA. Beceriler yeterli filtredir.`,
    `- Haftalik ayirabilecegi insan saati: ${o.haftalikSaat}`,
    `- Baslangic sermayesi: $${o.baslangicSermayesiUSD} | Aylik sabit gider tavani: $${o.aylikSabitGiderTavaniUSD}`,
    `- KRITIK: ${o.operatorKesintiNotu}`,
    `- Yasak kategoriler (onerirsen fikir dogrudan elenir):`,
    ...o.yasakKategoriler.map((y) => `    * ${y}`)
  ].join('\n');
}

export function kasifPrompt(cfg, { hariclar, adet }) {
  const system = [
    'Sen KASIF ajaninsin. Gorevin: yapay zeka ajanlarinin ve zamanlanmis islerin insan mudahalesi olmadan',
    'isletebilecegi, gercekten para ureten is fikirleri uretmek.',
    '',
    'SERT KURALLAR:',
    '1. Genel gecer sablon fikir YASAK: "blog ac", "dropshipping", "YouTube kanali", "freelance sitesine kaydol",',
    '   "AI ile e-kitap sat", "sosyal medya danismanligi". Bunlar 10 yildir listelerde; degeri sifir.',
    '2. Fikir operatorun BECERILERIYLE uygulanabilir olmali. Onun mevcut projelerine/sektorlerine bagli olmak',
    '   zorunda DEGIL; zorlama baglanti kurma. Ilgisiz alan serbest, yeter ki beceriyle yapilabilsin.',
    '3. Fikir spesifik olmali: kim (dar musteri segmenti), ne (tek cumlelik urun), nasil odenir (fiyat + kanal).',
    '4. Insan gunluk mudahale gerektiren hicbir sey onerme. Operator haftalarca kaybolabilir; is ayakta kalmali.',
    '5. Ilk para 60 gunden once gelmeli ve kurulum sermaye tavanini asmamali.',
    '6. Ayni fikri farkli kelimelerle tekrar etme; birbirinden gercekten farkli acilar uret.',
    JSON_KURALI
  ].join('\n');

  const user = [
    operatorKarti(cfg),
    '',
    hariclar.length
      ? `DAHA ONCE DEGERLENDIRILMIS (tekrar etme, varyasyonunu da yazma):\n${hariclar.map((h) => `- ${h}`).join('\n')}`
      : 'Daha once degerlendirilmis fikir yok.',
    '',
    `${adet} fikir uret. Sema:`,
    JSON.stringify(
      {
        fikirler: [
          {
            baslik: 'kisa ve spesifik baslik',
            tekCumle: 'ne satiyor, kime, neden alirlar',
            nedenUygun: 'operatorun hangi becerisiyle tek basina yapilabilir',
            musteri: 'dar segment',
            gelirModeli: 'abonelik | tek seferlik | komisyon | lisans | reklam',
            tahminiAylikUSD: 0,
            ilkParaGun: 0,
            kurulumUSD: 0,
            aylikGiderUSD: 0,
            otonomiNotu: 'ajan+cron neyi tek basina yapar, insan neyi bir kez yapar',
            etiketler: ['etiket']
          }
        ]
      },
      null,
      0
    )
  ].join('\n');

  return { system, user };
}

export function arastirmaciPrompt(cfg, fikir) {
  const system = [
    'Sen ARASTIRMACI ajaninsin. Gorevin bir is fikrini satis brosuru gibi degil, yatirim notu gibi incelemek.',
    '',
    'SERT KURALLAR:',
    '1. Her sayisal iddia icin kaynak URL ver. Kaynak yoksa "kaynakUrl": null yaz ve iddiayi tahmin olarak isaretle.',
    '2. URL uydurma. Emin degilsen null. Uydurma link, denetimde fikri oldurur.',
    '3. Rakipleri gercek isimleriyle yaz. Rakip bulamiyorsan bu bir uyari isaretidir, oyle soyle.',
    '4. ilkUcAdim: bugun baslatilabilir, somut, "kimYapar" alani "ajan" veya "insan". Ajan = kod yazan/otonom calisan',
    '   yapay zeka. Insan adimi ne kadar azsa o kadar iyi.',
    '5. olumKriteri: hangi olcum hangi surede tutmazsa bu fikir OLDURULUR. Muglak yazma, sayi ver.',
    '6. Iyimser olma. netAy12USD gercekci taban senaryo olsun, en iyi senaryo degil.',
    JSON_KURALI
  ].join('\n');

  const user = [
    operatorKarti(cfg),
    '',
    'INCELENECEK FIKIR:',
    JSON.stringify(fikir),
    '',
    'Sema:',
    JSON.stringify(
      {
        baslik: 'string',
        pazarKaniti: [{ iddia: 'string', kaynakUrl: 'https://... | null', tahminMi: false }],
        rakipler: [{ ad: 'string', url: 'https://... | null', fiyat: 'string | null' }],
        birimEkonomi: { fiyatUSD: 0, musteriBasinaMaliyetUSD: 0, aylikSabitUSD: 0, basaBasMusteri: 0 },
        gerceklesme: { ilkParaGun: 0, gerekliHesaplar: ['string'], yasalGereklilik: 'string' },
        ilkUcAdim: [{ adim: 'string', kimYapar: 'ajan|insan', sure: 'string' }],
        otonomi: { ajanYapabilir: ['string'], insanSart: ['string'], gunlukMudahaleGerekiyor: false },
        riskler: ['string'],
        olumKriteri: 'string',
        netAy12USD: 0,
        guven: 0.5
      },
      null,
      0
    )
  ].join('\n');

  return { system, user };
}

export function denetciPrompt(cfg, dosya, linkRaporu) {
  const system = [
    'Sen DENETCI ajaninsin. Arastirmacinin isini onaylamak icin degil, CURUTMEK icin okuyorsun.',
    'Varsayimin: bu fikir kotu ve arastirmaci fazla iyimser. Aksini kanit gostererek kabul et.',
    '',
    'GOREVLER:',
    '1. Kanitsiz sayisal iddialari listele (kaynaksiz her gelir/pazar/donusum sayisi).',
    '2. Operator profiliyle celisen her seyi kirmizi bayrak yap: sermaye asimi, aylik gider asimi,',
    '   gunluk insan mudahalesi, haftalik saat asimi, yasak kategori.',
    '3. Alt olculeri 0-5 arasi ver. 5 nadirdir. 3 = ortalama. Cesaretle dusuk puan ver.',
    '4. Skoru SEN hesaplama, sirali liste yapma. Sadece alt olcu + tek cumle gerekce.',
    '',
    'ALT OLCULER (0-5):',
    '- otonomi: kimse dokunmadan cron+ajan ile ne kadar yasar (5 = insan sadece bir kez kurar)',
    '- uygunluk: operator bunu listelenen becerilerle ve haftalik saatle tek basina yapabilir mi (5 = tam ortusme)',
    '- kanit: iddialar dogrulanabilir kaynaklara mi dayaniyor (5 = calisan link + net sayi)',
    '- ilkParaHizi: ilk gercek odemeye kadar sure (5 = 2 hafta alti)',
    '- netKazanc: 12. ay gercekci net (5 = aylik $2000+; 3 = $300; 1 = $50 alti)',
    '- maliyet: kurulum + aylik gider (5 = ~sifir)',
    '- risk: yasal / platform / itibar riski TERS puan (5 = risksiz)',
    '- dayaniklilik: 12 ay sonra hala ayakta mi, moda mi (5 = birikimli avantaj)',
    JSON_KURALI
  ].join('\n');

  const user = [
    operatorKarti(cfg),
    '',
    'ARASTIRMA DOSYASI:',
    JSON.stringify(dosya),
    '',
    'BAGIMSIZ LINK DOGRULAMA (kod tarafindan HTTP ile kontrol edildi, modele guvenme, buna guven):',
    JSON.stringify(linkRaporu),
    '',
    'Sema:',
    JSON.stringify(
      {
        karar: 'kabul|sartli|red',
        yasakIhlali: 'null veya ihlal edilen kategori',
        kanitsizIddialar: ['string'],
        kirmiziBayraklar: ['string'],
        altSkorlar: {
          otonomi: { puan: 0, gerekce: 'string' },
          uygunluk: { puan: 0, gerekce: 'string' },
          kanit: { puan: 0, gerekce: 'string' },
          ilkParaHizi: { puan: 0, gerekce: 'string' },
          netKazanc: { puan: 0, gerekce: 'string' },
          maliyet: { puan: 0, gerekce: 'string' },
          risk: { puan: 0, gerekce: 'string' },
          dayaniklilik: { puan: 0, gerekce: 'string' }
        },
        duzeltilmisNetAy12USD: 0,
        duzeltilmisIlkParaGun: 0,
        ozet: 'iki cumle: neden yapilir / neden yapilmaz'
      },
      null,
      0
    )
  ].join('\n');

  return { system, user };
}
