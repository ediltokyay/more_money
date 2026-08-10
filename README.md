# Para ajanları — otonom fikir araştırma ve puanlama hattı

Üç rollü bir ajan hattı: **Kâşif** fikir üretir, **Araştırmacı** her fikri yatırım notu gibi kazır,
**Denetçi** düşmanca okur ve 0–5 alt ölçü verir. Sıralamayı model değil **kod** yapar.
Çıktı: her turda tek bir markdown rapor + kalıcı fikir defteri.

```
KÂŞİF ─► ön eleme ─► ARAŞTIRMACI ─► link doğrulama (HTTP) ─► DENETÇİ ─► puanlama (kod) ─► defter ─► rapor
composer-2.5   ucuz    composer-2.5      gerçek ölçüm      grok-4.5-high   deterministik   hafıza   tek iş
```

## Model kaynağı: Cursor CLI

Varsayılan sağlayıcı **Cursor CLI**'dir; API faturası yerine Cursor üyeliğindeki havuzdan düşer.
Çağrı şekli deponun çalışan yolundan alındı (`scripts/dogrula.ps1`):

```
agent -p --trust -f --model <model> --output-format text <prompt>
```

Rol → model eşlemesi `scripts/model-policy.ps1` sınıflandırmasıyla hizalı:

| Rol | Model | Sınıf |
|---|---|---|
| Kâşif + Araştırmacı | `composer-2.5` | HAFİF — çok sayıda ucuz koşu |
| Denetçi | `cursor-grok-4.5-high` | AĞIR — tek, dikkatli koşu |

Bütçe burada dolar değil **çağrı adedi** ile tutulur (`akis.runCagriTavani`, varsayılan 30).
Rapor da dolar yerine "çağrı: N/30 (Cursor havuzu)" yazar.

Windows'ta prompt varsayılan olarak **stdin** ile verilir; böylece prompt içindeki `-14` gibi
parçalar CLI bayrağı sanılmaz. İstersen `agent-run.ps1` sarmalayıcısı (`ps1` modu) prompt'u
dosyadan okuyup yine stdin'e verir. Linux/macOS'ta argv kullanılır; prompt'tan önce `--`
konur. Zorlamak için `MONEY_CURSOR_MODE=argv|stdin|ps1`, binary adı için `MONEY_CURSOR_CMD`
(varsayılan: önce `cursor-agent`, yoksa `agent`).

Her çağrı **geçici boş bir dizinde** koşar. `-f` komut onayını otomatik verdiği için ajan bir araç
çalıştırmaya kalkarsa depo dışında kalır.

API tarafı da duruyor: `MONEY_LLM_PROVIDER=openai|anthropic` + `OPENAI_API_KEY` ile OpenAI, Anthropic
veya OpenAI-uyumlu herhangi bir uç (OpenRouter, DeepSeek, Groq) kullanılabilir; o modda bütçe dolar üzerinden işler.

## Hızlı başlangıç

```bash
npm run panel          # operatör paneli → http://127.0.0.1:8787
npm run money:dry      # CLI/anahtar olmadan, fixture ile tam hat (hiçbir şey harcamaz)
npm run money:test     # kapıların çalıştığını doğrular
npm run money          # gerçek tur — Cursor CLI ile
npm run money:list     # defterdeki tüm fikirler
```

**Operatör paneli** (`npm run panel`): canlı ajan akışını izle, defteri gör, raporu oku,
kopyala veya `.md` olarak indir. Varsayılan yalnızca localhost — gerçek tur başlatabildiği için
dışarı açma. `8787` doluysa sonraki boş porta geçer; zorlamak için
`npm run panel -- --port 8790`.

Örnek çıktı: [`reports/ornek-rapor.md`](reports/ornek-rapor.md) (kuru çalışmayla üretildi).

## Neden bu tasarım

Klasik "ajanlar fikir bulsun, bir ajan onaylasın" kurgusunun üç bilinen çöküş noktası var.
Bu hat üçünü de kapatıyor:

**1. Model kendi fikrini yüksek puanlar.** Denetçi sıralama yapmaz, skor vermez. Yalnızca sekiz alt ölçüye
0–5 arası puan + tek cümle gerekçe verir. Ağırlıklı skoru `src/score.mjs` hesaplar. Aynı girdi hep aynı skoru
üretir, ağırlıkları `config.json` üzerinden sen değiştirirsin. Denetçinin araştırmacıdan farklı bir model
olması (grok ↔ composer) da bilerek: aynı modelin kendi çıktısını denetlemesi zayıf bir denetimdir.

**2. Model kaynak uydurur.** Araştırmacının verdiği her kaynak linki `src/links.mjs` tarafından gerçekten
HTTP ile çekilir. Açılmayan link fikre puan cezası yazar ve **kanıt alt ölçüsüne tavan** koyar: hiç çalışan
link yoksa model "kanıt: 5" dese bile kanıt 1'e iner. Sistemdeki tek insan-dışı gerçek ölçüm budur.

**3. Her tur aynı fikirler yeniden keşfedilir.** `data/ledger.json` kalıcı hafızadır. Kâşife "bunları
tekrar etme" listesi gider, dönen fikirler Jaccard benzerliğiyle (Türkçe ekler için kaba gövdeleme)
defterle karşılaştırılır, eşik üstü tekrar araştırmaya bile girmez — kota harcamadan elenir.

## Operatör profili

`config.json > operator` sistemin tek ayar noktası. İki liste ayrıdır ve bu ayrım önemli:

- **`beceriler`** — fikri uygulayabileceğin teknik yetenekler. Filtre budur.
- **`mevcutIsler`** — mevcut projelerin/işlerin. **Varsayılan boş.** Boşken ajanlara açıkça
  "fikri bir projeye ya da sektöre bağlamaya çalışma" denir; sonuç, becerilerle yapılabilen ama
  ilgisiz alanlarda da olabilen fikirler olur.
- **`varlikKullanimi`** — `serbest` (varsayılan) ya da `zorunlu`. Bir işini listeye ekleyip `zorunlu`
  yaparsan ajanlar her fikri ona bağlamak zorunda kalır. Bunu ancak bilinçli olarak dar bir tur
  istediğinde aç.

`uygunluk` alt ölçüsü de buna göre tanımlı: "operatör bunu listelenen becerilerle ve haftalık saatle
tek başına yapabilir mi", "mevcut işine ne kadar benziyor" değil.

## Kapılar

| Kapı | Ne yapar |
|---|---|
| **Yasak kategori** | `operator.yasakKategoriler` içindeki bir şey önerilirse skor 0, durum `red`. Tartışma yok. |
| **WIP kilidi** | Defterde `pilot` durumunda iş varken yeni fikir **onaya çıkamaz**. Rapor "önce şunu bitir" der. `--force-new` ile bilerek açılır. |
| **Çağrı / bütçe tavanı** | Cursor'da çağrı adedi, API'de dolar. Tavan aşılırsa tur kısalır, elde kalanla rapor yazılır. |
| **Sermaye / gider tavanı** | Kurulum sermayeyi, aylık gider tavanı aşarsa ceza. |
| **Günlük müdahale** | İnsanın her gün dokunması gereken fikir ağır ceza alır. |
| **Ölüm kriteri** | Araştırmacı her fikir için "hangi ölçüm hangi sürede tutmazsa bu öldürülür" yazmak zorunda. |

## Fikrin yaşam döngüsü

```
izlemede ──► onaylı ──► pilot ──► canlı
                 │         │
                 └──► elendi / öldürüldü
```

```bash
node run.mjs --pilot <id>            # işe başladın (WIP dolar)
node run.mjs --canli <id>            # para kazanıyor (WIP boşalır)
node run.mjs --oldur <id> "sebep"    # ölüm kriteri tuttu
```

Elle koyduğun `pilot` / `canlı` / `öldürüldü` durumlarını otomatik turlar ezmez.

## Puanlama

Ağırlıklar (`config.json > puanlama.agirliklar`), toplam üzerinden %100'e normalize edilir:

| Ölçü | Ağırlık | Ne sorar |
|---|---|---|
| otonomi | 3.0 | Kimse dokunmadan cron + ajan ile ne kadar yaşar |
| uygunluk | 2.5 | Operatör bunu becerileriyle ve haftalık saatiyle tek başına yapabilir mi |
| kanıt | 2.0 | İddialar doğrulanabilir kaynağa dayanıyor mu (link testiyle tavanlı) |
| ilkParaHizi | 2.0 | İlk gerçek ödemeye kadar süre |
| netKazanc | 2.0 | 12. ay gerçekçi net |
| maliyet | 1.5 | Kurulum + aylık gider |
| risk | 1.5 | Yasal / platform / itibar riski (ters) |
| dayanıklılık | 1.0 | 12 ay sonra hâlâ ayakta mı |

Eşikler: **70+ onaylı**, 50–70 izlemede, altı elendi. `sartli` denetçi kararı tek başına onaya yetmez.

## Zamanlama

**Yerel (Cursor havuzu için doğal yol).** Cursor CLI giriş yaptığın makinede çalışır; haftalık turu
Windows Task Scheduler ile ya da jarvis job olarak kur:

```powershell
node run.mjs
```

**CI (`.github/workflows/money-agents.yml`).** Her pazartesi 06:00 UTC. Sağlayıcı merdiveni:
`CURSOR_API_KEY` secret'ı varsa Cursor CLI kurulur ve havuzdan çalışır; yoksa `MONEY_LLM_API_KEY`
ile API yolu; o da yoksa kuru çalışır ve PR açmaz. Rapor + defter değişikliği PR olarak açılır
(Settings > Actions > General > "Allow GitHub Actions to create and approve pull requests" açık olmalı).

## Bu repo ne

Bağımsız para-fikir hattı. Savasci / web2 ile aynı depoda yaşamaz.
Cursor CLI çağırma biçimi ve rol→model politikası oradaki jarvis/`scripts` hattından
öğrenilmiştir; kod ve CI buraya aittir.

## Dürüst sınır

Bu hat **araştırmayı ve kararı** otomatikleştirir; **parayı** otomatikleştirmez. Hiçbir kurulum
senin adına ödeme hesabı açamaz, fatura kesemez, sözleşme imzalayamaz. Sistem bunu saklamak yerine
ölçüyor: her rapor "ajan neyi yapar / insan neyi bir kez yapmak zorunda" ayrımını yazar ve insan
adımı çok olan fikri aşağı çeker. Rapordaki `[ajan]` etiketli adımlar doğrudan bir Cursor ajanına
görev olarak verilebilir.

## Dosyalar

| Dosya | Sorumluluk |
|---|---|
| `run.mjs` | CLI, durum komutları |
| `panel.mjs` | Operatör paneli (canlı akış, rapor, indirme) |
| `panel/` | Panel arayüzü (HTML/CSS/JS) |
| `config.json` | Operatör profili, ağırlıklar, cezalar, eşikler, akış limitleri, model seçimi |
| `agent-run.ps1` | Windows Cursor CLI sarmalayıcısı (prompt dosyadan → stdin) |
| `src/pipeline.mjs` | Turun orkestrası, ön eleme, eşzamanlılık |
| `src/prompts.mjs` | Üç rolün promptları (anti-şablon kuralları burada) |
| `src/agents.mjs` | Rol sarmalayıcıları + çıktı şeması doğrulaması |
| `src/score.mjs` | Deterministik ağırlıklı skor + cezalar |
| `src/ledger.mjs` | Kalıcı defter, tekrar filtresi, WIP kapısı |
| `src/links.mjs` | Kanıt linklerinin HTTP doğrulaması |
| `src/llm.mjs` | Sağlayıcı bağımsız istemci, bütçe muhasebesi, yeniden deneme |
| `src/cursor-cli.mjs` | Cursor CLI spawn katmanı (argv / stdin / ps1 modları) |
| `src/mock-provider.mjs` | Offline fixture (test ve `--dry-run`) |
| `data/ledger.json` | Fikir hafızası (commit edilir) |
| `reports/` | Tur raporları (kuru çalışma çıktıları gitignore) |

Bağımlılık yok: Node 18+ yeterli, `node --test` ile testler (sahte CLI binary'si + panel API dahil).
