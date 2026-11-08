# agent.family (TermiX) incelemesi ve Binera uyarlaması — REA yöntemiyle

İnceleme tarihi: 8 Kasım 2026. Yöntem: REA'nın ("Reverse Engineer Anything") web hedefleri için önerdiği kanıt-öncelikli gözlem akışı — kaynak kopyalanmadan, yalnızca canlı davlara (SSR çıktısı) bakılarak davranış katmanı çözümlemesi. Hiçbir kod, metin veya görsel kopyalanmadı; yalnızca **çalışan yapı** (sistem davranışı) analiz edilip Binera'nın kendi mimarisi, kendi arayüz dili ve kendi doğruluk ilkeleri ile yeniden kuruldu.

## 1. Gözlem kanıtı (canlı SSR içeriğinden)

agent.family, Next.js App Router tabanlı bir SSR istemcisidir. Genel robots.txt şu yolları kısıtlar: `/account`, `/inbox`, `/dashboard`, `/listing-editor`, `/evaluator`, `/order`, `/resolution`, `/scan`, `/r/` — yani tarayıcı oturumu gerektiren özel akışlar.

Kamuya açık davranış katmanı:

| Yol | Çözümlenen davranış |
| --- | --- |
| `/` | Görev gireceği ana satır (tek prompt alanı) + üç eylem (listing / open request / bounty). Canlı ağ okuması (işlem hacmi, indexlenen agent sayısı, toplam iş, protokol geliri) güven inşası için kullanılıyor. Öne çıkan servis kartları "istediği kadar önerim" değil, gerçek iş geçmişi + repütasyon gösterimi. |
| `/search` | Servis pazarı: bütçe, teslim süresi, tier, minimum reputation filtreleri; Recommended/price/delivery sıralama arkadaşları; "open requests" ve "bounties" ikinci kategori. |
| `/scan` | Agent dizini + iş panosu + doğrulama kayıtları (registry, jobs, verify). Register'ın tersine "kimin neyi kanıtladığını" merkezine koyar. |
| `/quant` | Strateji dizini: Yield/Grid/Rebalancing/Health factor kategorileri (Binera'nın dört kategorisiyle birebir aynı sistem davranışı), "not yet active"leri dahil etme filtresi, risk filtresi, sıralamalar. Para kullanıcının cüzdanında; agent yalnız limit içinde işlem yapar. |
| `/campaigns` | Ödül programları (points, bounty, hackathon track) — her biri kendi uygunluk ve ödeme kuralıyla. |
| `/docs` | Ajan tarafı çoklu dil SDK'ları + "skill kurulum promptu" ile ajan-agent entegrasyonu. |
| `/onboarding` | `.agent` kimliği sahiplenme — on-chain, kalıcı, cüzdanına bağlı. |

Bu gözlemler Binera'da **hangi davranışların zaten doğru yapıldığını** da doğruladı: Binera'ın dört kategorisi, imzalı teklif + ERC-8183 escrow akışı, kanıt kademeleri (registered → published → live → compatible → proven delivery) ve non-custodial cüzdan gereklilikleri, agent.family'nin ürün çatısıyla aynı davranış alanını zaten sindirmiş durumda.

## 2. Binera'ya uyarlama kararı (kopyalamadan)

### Neden kopyalama değil?
- Farklı doğruluk kültürü: agent.family canlı global hacim ve points metrikleri gösteriyor; Binera bunları kendisi ölçmediği için göstermez. Binera yalnızca kendi kaynağından ölçülen sayıları gösterir (8004scan BSC kayıtları, PancakeSwap okuması, reviewed catalogue).
- Farklı model: Binera çok konalı "araştırma işi satın alma" üzerinde müzakere/escrow akışına dayanır; zincir temsil yetkisi dar izinlerle sınırlıdır. Estrategi otomasyonu iddiası yok.
- Aynı framework (Next.js) olsa da tüm bileşen/avuç tasarım Binera'nın var olan uyum arayüzü (DM Sans/Manrope, yeşil palette, manuel CSS) ile yazıldı.

### Eklenen sistem (`/research` — Research desk)`i Binera'nın var olan modüler bitirme katmanını yeniden derler:

| agent.family davranışı | Binera karşılığı |
| --- | --- |
| Ana sayfa canlı ağ okuması | `stat-tile` kümesi: `/api/registry/stats` (toplam BSC kayıtlı agent'lar, A2A/MCP yayını), `/api/market` (PancakeSwap v3 spot bloğu), `reviewed catalogue`sayısı — üçü de `ts`-the-source notlu. |
| Sayfa başı "ne yaptıralım" giriş | Zaten `/` üzerinde var; mevcut akışla birleşti. |
| `/scan` (token doğrula) | **Token scan** kartı → kendi `/api/research/security` entegrasyonumuz (public GoPlus token-security API), kanıt + not ile kullanım. |
| `/quant` havuz/aracı araştırma | **Pool / Account health** kartı → var olan `/api/research/context` (`kind=pool` PancakeSwap v3 queer factory doğrulamalı; `kind=health` Venus Core getAccountLiquidity). |
| Servifere/ticari "hizmetler" dizini | **x402 agent hizmetleri** bölümü — var olan `XonaServices`, xona x402 katalog plus payment preview. |
| Öne çıkan (featured) servis kartları | **Reviewed sellers** bölümü: `/api/discover` (derlemiş araştırma derlemesi) → kanıt rozetli 8 kart + agent detay bağı. |
| Docs → timber | `/docs` sayfasına Research desk köprüsü (Discovery bölümü). |

### Kasıtlı yapılmayanlar
- Global işlem hacmi / protokol geliri / points programı / bounty / `.agent` ID minleme — Binera bunları gerçek ve ölçülebilir olmadığı için sunmaz. (Yaşamakta olan "iş" verisi Binera'da kullanıcının kendi dashboard'ında kanıtlı iş olarak yaşar.)
- GitHub/SDK lay out: Binera'nın agent tarafına MVC/skill kaydını değil, gerçek çalışan satıcı kitaplığı vardır.

## 3. Genişletilmiş boşluk matrisi (iş alımı → UX)

Referans kanıtları: agent.family `/trust` sayfası (escrow → challenge → public audit), `docs.termix.ai` AACP belgeleri (order lifecycle, delivery hash, dispute phases, timeout path'leri) ve canlı ürün sayfaları. Aşağıdaki karşılaştırma "davranış" düzeyindedir; hiçbir metin/görsel kopyalanmadı.

| Alan | Referans davranışı | Binera'daki durum | Bu turda yapılan güvenli aksiyon |
| --- | --- | --- | --- |
| İş alımı (intake) | Fon öncesi kapsam/rubrik/fiyat/challenge penceresi özeti | Task formu + imzalı teklif vardı; fon öncesi özet yoktu | **Preflight checklist**: kilitli kapsam, ücret, çıktı, kalite standardı, teklif süresi, escrow davranışı, "research-only" sınırı — fon onayından hemen önce |
| Ajan çalıştırma | `acceptWindow`, `deliveryDueAt`, süre aşımı yolları; "broadcast = tamamlanma değildir" | `jobActions` doğruydu; kalan süre görünmüyordu | **JobWindows**: teslimat ve itiraz penceresi için canlı geri sayım + "kontrat saati esastır" notu; zincir verisi yoksa "Not opened yet" (uydurma yok) |
| Teslimat kalitesi | Teslimat hash'i + rubrik + tek redo | Hash doğrulama ve çıktı gösterimi vardı | Aynı veriler üzerine preflight kalite standardı + doğrulanmış çıktı paneli mevcut akışta korunuyor; otomatik onay eklenmedi |
| Gizlilik | Katılımcıya özel okumalar; anahtar tutmama | Public ref'ler localStorage'da; export var; temizleme UI yoktu | **Privacy & device data** paneli: sayımlar, public export, kapsam bazlı temizleme; passkey referanslarına dokunmaz, mesaj açık |
| Güvenlik | Escrow + imza + hash doğrulama | Başlıklar vardı | `X-DNS-Prefetch-Control: off` + production'da `Strict-Transport-Security` |
| Doğrulama | Public audit trail, explorer ile uzlaştırma | Explorer linkleri + hash kontrolü vardı | Docs'ta **Trust & verification** bölümü: yaşam döngüsü, bağımsız kontrol adımları, "neyin doğrulanmadığı" listesi |
| UX | Durum haritası, sonraki eylem, kurtarma yolu | Dashboard "next step" ve 30 sn yenileme vardı | Docs'a preflight köprüsü; `/saved` üzerinde cihaz verisi kontrolü; hata/boş durumlar korunuyor |
| Pazaryeri protokolü | Hizmet listeleri, açık talepler, teklifler, kabul akışı, canlı olay akışı | Yalnızca registry keşfi + bire bir imzalı teklif vardı | ✅ **Agent exchange**: cüzdan-imzalı liste/talep/teklif/kabul, çok-slotlu bounty, SSE olay akışı, katmanlı doğrulama ve tekrar-kullanım koruması; ajan API'si `docs/exchange-api.md` |
| Liderlik / itibar | Gerçek iş geçmişine göre sıralama | Yalnızca kart bazlı feedback alanı | ✅ **Leaderboard**: canlı 8004scan feedback sıralaması, kategori liderleri, kanıt kademeleri ayrı; yerel exchange aktivitesi ayrı etiketli |
| Ajan entegrasyonu | Skill/SDK dağıtımı | Sadece doküman | ✅ **Agent SDK** (`src/lib/agent-client.ts`) + çalıştırılabilir örnek + testler |
| Stake / itibar / arbitrasyon | Zincir üstü stake, itibar, 3 kişilik panel | Yoktu | ✅ **Solidity protokolü**: stake, reputation, arbitration, bounty vault + 10 Hardhat testi + deploy betiği; `/protocol` gerçek yapılandırma/bytecode durumunu dürüstçe gösterir (deploy edilmedi) |

**Kasıtlı olarak uygulanmayanlar (güvenli değil / altyapı gerektiriyor):** açık talep panosu ve bounty vault (sunucu tarafı kalıcılık + yeni escrow sözleşmesi gerektirir; bu depo kasıtlı olarak veritabanı tutmaz), otomatik değiştirilebilir challenge bond/arbitrasyon (mevcut ERC-8183 policy'si neyse o), herhangi bir "global hacim/points" metriği (ölçülmüyor). Bunlar uydurulmadı.

## 4. Doğrulama

- `npm run typecheck`, `npm run lint`, `npm test` (50/50; pazaryeri, imza, bounty, SDK, job pencereleri ve cihaz verisi testleri): temiz.
- `npm run build` (production): başarılı; `/research`, `/exchange` ve `/leaderboard` dahil 24 rota. Production başlıkları doğrulandı (HSTS, DNS-Prefetch, mevcut korumalar); `/api/health` → `chain: ok`, `discovery: ok`, `tokenSecurity: goplus-public`.
- **Agent exchange E2E:** Gerçek EIP-191 imzalı üç yazma uçtan uca doğrulandı — talep 201, teklif 201, kabul 200; anlık görüntüde durum `accepted`. Sahte imza 401 ile reddedildi. UI `/exchange` canlı yüklendi; talep, iki teklif ve hizmet listesi kartlarıyla render edildi; konsol hatası yok.
- **Bounty E2E:** 3 slotlu talep; iki teklif sonrası bir slot kabul edildi → `1/3`, talep açık kaldı, ikinci teklif `pending`, UI "Bounty · 1/3 slots" gösterdi.
- **Leaderboard E2E:** canlı 8004scan verisinden 25 satır, 4 kategori lideri; sayfa konsol hatasız. Kaynak toplamı 376.990 kayıt.
- **Ajan SDK:** imzalı envelope üretimi, doğru rotaya gönderim ve sunucu tarafında imza doğrulaması testlerle kanıtlandı.
- **Kontratlar:** `npm run test:contracts` → 10/10 (stake kilidi/slash sınırı, skor tavanı, panel kompozisyonu, çift oy, süre aşımı, bounty muhasebesi). `npm run compile:contracts` temiz. Deploy edilmedi; `/api/protocol` ve `/protocol` durumu `not-configured` olarak raporluyor.
- Canlı tarayıcı E2E: `/research` canlı verilerle doldu; "Read onchain" hem `kind=health` hem `kind=pool` gerçek RPC okuması yaptı; token taraması geçerli checksum'da nazik 503, bozuk checksum'da doğrulama hatası verdi; x402 önizleme gerçek sağlayıcı yanıtı döndürdü.
- Yeni akışların E2E'si: `/saved` cihaz verisi paneli sayımları doğru gösterdi ve kapsam bazlı temizleme yalnızca hedef anahtarı sildi (passkey ve diğer kapsamlar korundu). Canlı satıcıdan alınan 0.1 U imzalı teklifte **preflight checklist** 7 maddesiyle render edildi.
- Yakalanan regresyon: ilk sürümde iki aksiyon butonunda `onClick={void fn}` handler'ı bağlamıyordu; tarayıcı E2E'si yakaladı, `() => void runX()` olarak düzeltildi ve yeniden doğrulandı.
- Kurulum tamamı **ekleme** niteliğinde: yeni rota `/research`, yeni bileşen `src/components/research-toolkit.tsx`, `shell.tsx` navigasyon/breadcrumb girişleri, `docs/page.tsx` tek köprü cümlesi ve globals.css ek blokları. Keşif/kiralama/escrow akışlarına işlevsel dokunma yok.
- Kurulum tamamı **ekleme** niteliğinde: yeni rota `/research`, yeni bileşen `src/components/research-toolkit.tsx`, `shell.tsx` navigasyon/breadcrumb girişleri, `docs/page.tsx` tek köprü cümlesi ve globals.css ek blokları. Keşif/kiralama/escrow akışlarına işlevsel dokunma yok.
