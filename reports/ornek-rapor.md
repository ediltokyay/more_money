# Para raporu — 2026-08-10 (run 2026-08-10-c897)

saglayici: `mock` · uretilen: 5 · arastirilan: 5 · maliyet: $0.0035 · sure: 0s

> **KURU CALISMA.** Bu rapor fixture verisiyle uretildi, gercek pazar arastirmasi degildir.

## Bu haftanin tek isi

**Kucuk e-ticaret sitelerine haftalik otomatik teknik saglik raporu** — 78.6/100

Siteyi haftada bir tarar, kirik link / yavas sayfa / eksik etiket raporunu e-postayla yollar; aylik abonelik.

Ilk hamle:
1. [ajan] Tek sayfalik satis sayfasi + odeme linki yayina al (1 gun)
1. [ajan] Calisan bir demo/prototip cikar (3 gun)
1. [insan] Hedef toplulukta 20 kisiye demo linki gonder (2 saat)

Olum kriteri: **6 hafta icinde 3 odeyen musteri yoksa oldur**

Kabul edersen defterde durumu `pilot` yap: `node run.mjs --pilot kucuk-e-ticaret-sitelerine-haftalik-otom-5ac310`

## Siralama

| # | Fikir | Skor | Durum | Ilk para | 12. ay net | Otonomi |
|---|-------|------|-------|----------|------------|---------|
| 1 | Kucuk e-ticaret sitelerine haftalik otomatik teknik saglik raporu | 78.6 | onayli | 28 gun | $126 | 4/5 |
| 2 | Yerel hizmet isletmelerine otomatik musteri geri-donus hatirlatma servisi | 72.1 | onayli | 21 gun | $95 | 4/5 |
| 3 | Dosya formati donusturen kredili self-servis API | 58.5 | izlemede | 37 gun | $69 | 5/5 |
| 4 | E-ticaret magazalarina haftalik site saglik taramasi aboneligi | 49.5 | elendi | 32 gun | $120 | 3/5 |
| 5 | Airdrop farming botu ile pasif kripto geliri | 0 | red | 52 gun | $472 | 0/5 |

## Detaylar

### 1. Kucuk e-ticaret sitelerine haftalik otomatik teknik saglik raporu — **78.6/100** (onayli)

Siteyi haftada bir tarar, kirik link / yavas sayfa / eksik etiket raporunu e-postayla yollar; aylik abonelik.

- **Neden yapilabilir:** Web tarama ve rapor uretimi Node ile yazilabilir; arayuz gerektirmez
- **Musteri:** Aylik 10-200 siparis alan kucuk magazalar | **Gelir modeli:** abonelik
- **12. ay net (denetlenmis):** $126 | **Ilk para:** 28 gun | **Kurulum:** $12 | **Aylik gider:** $8
- **Alt olculer:** otonomi 4/5 · uygunluk 5/5 · kanit 4/5 · ilkParaHizi 4/5 · netKazanc 3/5 · maliyet 5/5 · risk 4/5 · dayaniklilik 4/5 (ham 82.6)
- **Cezalar:** kanitsizIddia -4 (1 kanitsiz sayisal iddia)

**Ilk uc adim**
1. [ajan] Tek sayfalik satis sayfasi + odeme linki yayina al — 1 gun
1. [ajan] Calisan bir demo/prototip cikar — 3 gun
1. [insan] Hedef toplulukta 20 kisiye demo linki gonder — 2 saat

**Olum kriteri:** 6 hafta icinde 3 odeyen musteri yoksa oldur
**Otonomi:** ajan yapar: kod, dagitim, fatura, destek e-postasi taslagi | insan sart: odeme hesabi acilisi, ilk tanitim mesaji | gunluk mudahale: hayir

**Denetci kirmizi bayraklari**
- Ucretsiz rakip araclar var; farklilasma tek satirda anlatilabilmeli

**Kanitsiz iddialar:** aylik $400 gelir tahmini kaynaksiz

> Fixture denetimi: gercek run icin API anahtari gerekir.

### 2. Yerel hizmet isletmelerine otomatik musteri geri-donus hatirlatma servisi — **72.1/100** (onayli)

Isletmenin musteri listesine periyodik kisisellestirilmis hatirlatma gonderir, randevuyu takvime yazar.

- **Neden yapilabilir:** Zamanlanmis mesaj + takvim entegrasyonu standart otomasyon isi
- **Musteri:** Randevuyla calisan kucuk yerel isletmeler (TR) | **Gelir modeli:** abonelik
- **12. ay net (denetlenmis):** $95 | **Ilk para:** 21 gun | **Kurulum:** $5 | **Aylik gider:** $10
- **Alt olculer:** otonomi 4/5 · uygunluk 4/5 · kanit 3/5 · ilkParaHizi 5/5 · netKazanc 3/5 · maliyet 5/5 · risk 3/5 · dayaniklilik 3/5 (ham 76.1)
- **Cezalar:** kanitsizIddia -4 (1 kanitsiz sayisal iddia)

**Ilk uc adim**
1. [ajan] Tek sayfalik satis sayfasi + odeme linki yayina al — 1 gun
1. [ajan] Calisan bir demo/prototip cikar — 3 gun
1. [insan] Hedef toplulukta 20 kisiye demo linki gonder — 2 saat

**Olum kriteri:** 6 hafta icinde 3 odeyen musteri yoksa oldur
**Otonomi:** ajan yapar: kod, dagitim, fatura, destek e-postasi taslagi | insan sart: odeme hesabi acilisi, ilk tanitim mesaji | gunluk mudahale: hayir

**Denetci kirmizi bayraklari**
- Mesaj gonderimi platform kurallarina takilabilir; onayli sablon sart

**Kanitsiz iddialar:** %30 geri donus orani iddiasi kaynaksiz

> Fixture denetimi: gercek run icin API anahtari gerekir.

### 3. Dosya formati donusturen kredili self-servis API — **58.5/100** (izlemede)

Nis bir dosya formatini yaygin formata ceviren, kredi ile calisan API ve web arayuzu.

- **Neden yapilabilir:** Donusum hattini Node ile kurmak dogrudan beceri kapsaminda
- **Musteri:** Bu formatla calisan kucuk studyolar ve bagimsiz gelistiriciler | **Gelir modeli:** tek seferlik
- **12. ay net (denetlenmis):** $69 | **Ilk para:** 37 gun | **Kurulum:** $15 | **Aylik gider:** $12
- **Alt olculer:** otonomi 5/5 · uygunluk 4/5 · kanit 2/5 · ilkParaHizi 3/5 · netKazanc 2/5 · maliyet 4/5 · risk 3/5 · dayaniklilik 2/5 (ham 66.5)
- **Cezalar:** kanitsizIddia -8 (2 kanitsiz sayisal iddia)

**Ilk uc adim**
1. [ajan] Tek sayfalik satis sayfasi + odeme linki yayina al — 1 gun
1. [ajan] Calisan bir demo/prototip cikar — 3 gun
1. [insan] Hedef toplulukta 20 kisiye demo linki gonder — 2 saat

**Olum kriteri:** 6 hafta icinde 3 odeyen musteri yoksa oldur
**Otonomi:** ajan yapar: kod, dagitim, fatura, destek e-postasi taslagi | insan sart: odeme hesabi acilisi, ilk tanitim mesaji | gunluk mudahale: hayir

**Denetci kirmizi bayraklari**
- Ucretsiz acik kaynak donusturucular var; odeme istegi belirsiz

**Kanitsiz iddialar:** talep hacmi icin kaynak yok · donusum basina fiyat rakip verisiyle desteklenmemis

> Fixture denetimi: gercek run icin API anahtari gerekir.

## Elenenler

- **Airdrop farming botu ile pasif kripto geliri** — yasak kategori: kripto spekulasyon / token / airdrop

## Defter

toplam 5 fikir · onayli 2 · izlemede 1 · pilot 0 · canli 0 · elendi 1 · red 1 · olduruldu 0
