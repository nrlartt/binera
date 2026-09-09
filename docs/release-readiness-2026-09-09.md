# AgentMarket — Canlıya çıkış ve yarışma hazırlık değerlendirmesi

İnceleme: 9 Eylül 2026, Europe/Istanbul. Bu bir kod ve kanıt değerlendirmesidir; jüri puanı, güvenlik denetimi veya kazanma tahmini değildir.

**Karar: Ürün yönü doğru; mevcut sürüm genel kullanıma ve eksiksiz yarışma başvurusuna hazır değil.** Çalışan keşif arayüzü ve entegrasyon kodu var. Gerçek parayla tamamlanmış iş, teslimat ve izin iptali kanıtı henüz yok. Kullanıcının ekran görüntüsü passkey hesabının oluşturulduğunu gösteriyor; ödeme veya tamamlanmış görev kanıtı sayılmaz.

## Resmi koşullar ve zaman

[Resmi ana sayfa](https://www.bnbchain.org/en/hackathons/smart-money-era?tab=tracks): ürün marketplace; dört kategori eşit derinlikte, BSC üzerinde canlı agent'lar, değerlendirme boyunca erişilebilir çalışan uygulama bekleniyor. İşlevsellik, veri kalitesi ve çeşitlilik değerlendiriliyor. Ana kriterler için sayısal ağırlık yayımlanmıyor. Altana ödülü için explorer'da gerçek session işlemleri gerekiyor; testnet kabul ediliyor. Bu testnet istisnası ana track için BSC canlılık şartının yerine geçmez.

[Ana sayfanın bağladığı kayıt formu](https://docs.google.com/forms/d/e/1FAIpQLSdFb30r24sZcFJVDbMqXNJ1_45BJHanc7eFqwUniScDYZfX9A/viewform): build dönemi 9 Eylül 2026 12:00 UTC, yani Türkiye saatiyle 15:00'te bitiyor. Repo bağlantısı, proje açıklaması, ekip/iletişim bilgileri ve ödül adresi isteniyor. Okunan formun adı Registration; son teslim paketinin ayrı akışı olup olmadığı teyit edilmeli. Form partner seçeneklerinde Altana görünmüyor; AltLayer görünüyor. Kullanıcı adına form gönderilmedi veya şartlar kabul edilmedi.

[5 Ağustos tarihli resmi duyuru](https://www.bnbchain.org/en/blog/build-the-era-build-the-official-bnb-agent-studio-marketplace): değerlendirme 9–23 Eylül; sonuç duyurusu 5 Kasım. Duyurunun kategori anlatımı güncel Tracks sayfasından farklı; uygulama kapsamını daha açık olan güncel Tracks koşullarına göre değerlendiriyorum. PancakeSwap için trader/LP kullanıcısına somut fayda isteniyor; otomatik swap tek kabul edilen çözüm değil.

[TermiX'in kendi yarışma sayfası](https://www.agent.family/campaigns/bnb-build-the-era): TermiX entegrasyonu zorunlu değil. Agent Advantage Report zorunlu: en az üç gerçek görev, agent ile ve agentsız gerçekleştirilmiş; süre, maliyet, çıktı kalitesi ve çıktılar eklenmiş olmalı. Görevlerden en az biri trading/equities/security alanında. Eksik rapor ödül uygunluğunu engelliyor.

## Mevcut kanıt

- Canlı 8004scan sorgusu: 107 tekil kayıt; rebalancing 39, grid 33, yield 35, health 29. Kategoriler örtüştüğünden sayılar toplanmaz. Bu, sınırlı arama penceresidir; tüm ekosistem veya çalışan agent sayısı değildir.
- PancakeSwap havuz okuması başarılı: blok 120759358, kaynak zamanı 2026-09-08T21:36:18Z. Bu bir havuz gözlemidir; agent performansı veya kullanıcı kazancı değildir.
- Gerçek bir satıcıdan imzalı teklif alınması tarayıcı testiyle doğrulanıyor. Teklif alınması escrow ödemesi, görev kabulü veya teslimat değildir.
- Vercel kontrolü: `No existing credentials found`. Doğrulanmış public deployment yok.
- Gerçek kullanıcı cüzdanıyla transfer, session grant, escrow funding, teslimat, settlement/refund ve revoke zincirinin tamamlandığını gösteren kayıt yok.

## Kod incelemesi: tamamlanması gerekenler

| Öncelik | Bulgu / kanıt | Tamamlanma ölçütü |
| --- | --- | --- |
| P0 | Public URL yok; passkey localhost origin'inde oluşturulmuş. | Sabit HTTPS domain, production deploy, farklı cihazdan giriş ve test. Localhost passkey'inin production'da aynı şekilde çalışacağı varsayılmamalı; eski hesaptaki fon/izinler ayrıca yönetilmeli. |
| P0 | `activation.tsx` ve `dashboard.tsx` ödeme/izin kodu içeriyor fakat gerçek tam akış kanıtlanmadı. | Bilinen satıcıyla küçük tutarlı iş: bakiye → grant → fund → gerçek çıktı/hash → settlement → revoke. Her adımda tx hash, job ID, blok ve hesap bağlantısı kaydedilmeli. Refund/dispute ayrı uygun durumlarda sınanmalı. Fonlama ve imzalama kullanıcı kontrolünde. |
| P0 | `registry.ts` kategorileri ad/açıklama anahtar kelimelerinden çıkarıyor. BSC kaydı endpoint canlılığını kanıtlamıyor. | Kategoriler başına gerçek çalıştığı kanıtlanmış seçenekler; endpoint/protokol/ödeme uyumluluğu gözlemi ve gözlem zamanı. Uyumlu olmayan kayda aynı aktivasyon vaadi verilmemeli. |
| P0 | `studio.ts` tüm aktivasyonları kaynaklı araştırma raporu olarak müzakere ediyor. | Her kategorinin gerçek hizmeti ve aktivasyon koşulları belgelenmeli. LP yönetimi, grid emirleri, yield yönlendirme veya koruma sunduğu söylenen agent için o işi yaptığı gösterilmeli. Marketplace'in bu stratejileri kendisinin yeniden yazması şart değil; mevcut canlı sağlayıcıya doğru bağlanması gerekir. |
| P0 | `domain.ts`: kategori anlaşılmazsa metin/name araması ilgisiz agent'ları elemez. | Agent adı ve bilinmeyen niyet için deterministik arama; kanıt yoksa açık boş sonuç. |
| P1 | Karşılaştırma tablolarında risk/performans/fiyat çoğunlukla eksik. Feedback sayısı başarı oranı değil. | Kaynaklı tamamlanan iş geçmişi, hizmet kapsamı, gözlenen yanıt süresi, fiyatın zamanı, gerçek geri bildirim ayrıntıları. Kanıt bulunmayan APY/risk verisi üretilmemeli. |
| P1 | `activity.ts` kayıtları localStorage'a bağlı; doğrulaması zayıf. | Bozuk kayıtlar sayfayı çökertmemeli. Public referans import/recovery veya adres bazlı chain indexleme ile cihaz değiştirme ve depolama silinmesinden kurtarma. Sunucuda özel anahtar tutulmamalı. |
| P1 | `browser-wallet.tsx` transfer hash'i modal state'inde; relay/job referansları ayrı. | Gönderilen fon transferi kalıcı public geçmişe yazılmalı; receipt confirmed/reverted/unknown ayrılmalı; belirsiz transfer yeniden gönderilmemeli. BNB ve U fonlaması ayrı anlaşılır adımlar olmalı. |
| P1 | `notifyFunded` dönen iş kabul durumunu özel şemayla doğrulamıyor. | Satıcının kabul/red/gecikme yanıtı doğru gösterilmeli; HTTP başarısı görevin başladığı sayılmamalı. |
| P1 | Dispute/settlement düğmeleri zaman pencerelerini sözleşmeye bırakıyor. | Gerçek disputeWindow okunmalı; kullanıcı son süreyi ve hangi eylemin geçerli olduğunu görmeli; sayfa kapalıyken teslimat takibi/bildirim planı bulunmalı. |
| P1 | İzin listesi ilk 50 anahtarla sınırlı; eksik tarama artık unconfirmed gösteriliyor. | Tüm anahtarlar için sayfalama veya doğrudan anahtar doğrulama; eski aktif izinler kaçırılmamalı. |
| P1 | `/api/health` sabit ok döndürüyor; TermiX stdio yapılandırmasını hesaba katmıyor. Rate limit process içi. | Gerçek bağımlılık sağlık ölçümü, uptime/error alarmı, merkezi ingress limitleri, RPC/registry kota planı ve deploy rollback prosedürü. |
| P1 | Yetki politikası fonksiyonları sınırlar, satıcı gibi argümanları zincirde sabitlemez. | Tehdit modeli ve sınır testleri; istenmeyen çağrı/aşırı harcama/süresi dolmuş anahtar reddinin kanıtı. Bağımsız sözleşme ve entegrasyon incelemesi. |
| P2 | WalletConnect QR yok; injected wallet ve passkey var. | Mobil hedef kitlesi için karar verilmeli; eklenirse gerçek cihazda session/account/network değişim testleri. Ana track için bu belirli kütüphane zorunlu sayılmamalı. |

## Ödül bazında değerlendirmem

- **Ana track: yüksek konu uyumu, eksik çalışırlık kanıtı.** Discovery, comparison ve açıklanabilir deterministik sıralama güçlü başlangıç. Araştırma odaklı tek aktivasyon modeli dört kategorinin davranış derinliğini henüz göstermiyor. Tasarım polish'i bu açığı kapatmaz.
- **Altana: kod entegrasyonu var, ödül kanıtı yok.** Uygulamanın tarayıcıda yarattığı geçici alıcı session'ı, satıcının kendi Altana cüzdanıyla otonom çalıştığını tek başına kanıtlamaz. Alıcı ve agent tarafı adresleri ile gerçek Keystore/session işlemleri ayrı gösterilmeli.
- **TermiX: bugün rapor eksik.** MCP adapter'ını çalıştırmak raporun yerine geçmez. Kapsama uygun güvenlik analizi, yield seçenek araştırması ve LP araştırması görevleri seçilip insan baseline'ı ve agent çıktısı aynı koşullarda ölçülebilir. Bunlar önerilen deneyler; yapılmış sonuç değildir.
- **PancakeSwap: canlı veri okuması var, sonuç kanıtı zayıf.** Kullanıcının gerçek havuz/pozisyonuna bağlı bir araştırma veya yönetim kararının faydası ölçülmeli. Tek spot fiyat kartı yeterli kanıt değildir. Ölçüm; süre, maliyet, kapsam veya pozisyon sonucuna bağlanmalı, garanti kazanç iddiasına değil.

## Uygulama sırası

1. Bugün kapanıştan önce kayıt/son teslim akışını ve partner seçimini teyit et. Repo URL'si ve ekip bilgilerini hazırla; organizatörün istemediği bir materyali zorunluymuş gibi varsayma.
2. Sabit public domain ve deploy erişimini tamamla. Production origin'inde passkey oluştur/recover/fund akışını doğrula. Çalışan sürüm commit/tag ve rollback noktası oluştur.
3. Katalogdan gerçekten hizmet veren agent'ları doğrula; dört kategori için seçim → karşılaştırma → doğru aktivasyon → çıktı zincirini tamamla. Desteklenmeyen hizmetleri açıkça işaretle.
4. Gerçek fonlu kontrollü E2E kanıt paketini üret. Başarısız/reddedilmiş/süresi dolmuş işlemleri de test et. Kanıt tamamlanmadan gerçek kullanıcı fonlarıyla genel kullanımı açma.
5. Seçilen partner ödüllerinin kanıtlarını ekle. Zaman yetmiyorsa ölçülmemiş başarı iddiaları yerine tamamlanan kapsamı açıkça bildir.
6. Genel kullanım öncesinde P1 kayıt kurtarma, pending reconciliation, izleme, kota ve güvenlik incelemesini bitir.

Önerilen teslim paketi: public URL, repo/sürüm, kısa ürün videosu, dört kategori işlem/çıktı matrisi, onchain adres/tx/job listesi, kurulum rehberi, bilinen sınırlamalar ve seçilen partner raporları. Video bu incelemede doğrulanmış form zorunluluğu değil; jüriye akışı göstermek için öneridir.

## Bu turda yapılan UX düzeltmeleri

Cüzdan ağı otomatik algılanır ve değişiklikler bağlantıyı kesmeden gösterilir. BNB'ye geçiş için cüzdanın onayı istenir; tanınmayan BNB ağı sabit metadata ile eklenir, sonra tekrar kontrol edilir. Fonlama sırasında da ağ doğrulanır. Bu bir bridge veya çok ağlı işlem desteği değildir; ürün BSC üzerinde çalışır. Adres kopyalama; bağlı cüzdan, fonlama hedefi, marketplace hesap modalı ve dashboard'da mevcuttur. Başarılı/kopyalanamayan durumlar görünürdür.

Teknik davranış kaynakları: [EIP-3326](https://eips.ethereum.org/EIPS/eip-3326), [EIP-3085](https://eips.ethereum.org/EIPS/eip-3085).

Doğrulama sonucu: typecheck, lint ve production build başarılı. 10 tarayıcı senaryosu doğrulandı (ilk çalıştırmada 8 geçti; iki hata uygulamadan değil Next.js route announcer ile çakışan test seçicisinden kaynaklandı, seçici düzeltildikten sonra kalan 2 geçti). Ağ testleri yalnızca test ortamındaki EIP-1193 sağlayıcısıyla switch/add/red/yanlış başarı yanıtlarını sınar; gerçek Rabby/MetaMask fon transferinin başarı kanıtı değildir. Canlı registry, PancakeSwap okuması ve gerçek satıcı teklifi ayrıca geçti.


## Uygulama sonras? g?ncelleme

Bu raporun yukar?daki bulgular? ilk incelemenin kayd?d?r. Sonraki uygulamada ?u maddeler kapat?ld?: isim/bilinmeyen niyet aramas?, bozuk ge?mi? do?rulamas? ve public import, kal?c? fonlama ge?mi?i ve makbuz e?le?tirmesi, relay referans? sorgulama, sat?c? teslimat yan?t?n?n do?rulanmas?, dispute zaman?na g?re eylem kontrol?, sabit blokta izin sayfalama, canl? servis ?n kontrol?, ger?ek dependency health ve CI kontrolleri. Dashboard g?r?n?rken 30 saniyede bir g?ncellenir.

Canl? discovery en ?ok geri bildirim alan ve en yeni g?ncellenen kay?tlar? birlikte tar?yor. Kota hatalar? art?k unconfirmed olarak ayr?l?yor. D?rt kategori ara?t?rma g?revi i?in ger?ek imzal? teklifler al?nd?; g?ncel kaynaklar ve g?zlem saatleri [submission paketinde](../submission/README.md). Bu sonu?lar ?cretli teslimat veya ger?ek strateji otomasyonu kan?t? de?ildir.

H?l? kapanmayan ba?vuru engelleri: public deploy/repo URL, fonlu ger?ek E2E ve kategori hizmet sonu?lar?, kullan?c?/agent session kan?t?, se?ilen partnerlerin ?l??m raporlar?, origin ?zerinde kullan?c? hesab? ve ba??ms?z son inceleme. Organizasyonun kapan?? ve teslim ak??? kullan?c? taraf?ndan teyit edilmelidir. ??lem imzalar?/hesap eri?imi olmadan bu maddeler yaz?l?mla tamamland? diye i?aretlenemez.

Detayl? kullan?c? ad?mlar?: [owner-launch-guide-tr.md](owner-launch-guide-tr.md). Ba?vuru durumunu kontrol etmek i?in `npm run check:release`; eksik kan?tlar test ba?ar?s?zl??? gibi gizlenmez, ayr? BLOCKED olarak raporlan?r.
