# 4lpha incelemesi ve Binera genişleme planı

Uygulama güncellemesi: İlk altı ürün genişlemesi ve Profile sekmesi mevcut Next.js uygulamasına eklendi. Aşağıdaki inceleme, uygulama öncesi karar kaydıdır. Profile ve Saved agents cihazda saklanır; Health önizlemesi Venus Core likidite/shortfall verisidir, hesaplanmış health factor değildir. Gerçek otomasyon aşaması bu sürümün kapsamı dışında kalır. Güncel özellik ve sınırlar README'de açıklanır.

İnceleme tarihi: 9 Eylül 2026. Bu belge bir ürün ve uygulama incelemesidir. Önerilen özellikler henüz uygulanmadı. Binera'nın mevcut kaynak kodu ile 4lpha'nın herkese açık masaüstü/mobil arayüzü, kurulum ekranları ve dokümanları karşılaştırıldı. Rakipte hesap oluşturulmadı, imza verilmedi, fonlama veya işlem yapılmadı. Ekranda görünen ayar ile doğrulanmış yürütme birbirinden ayrıldı.

## Ürün kararı

Binera'nın geliştirilmesi gereken ana alanı **agent seçildikten sonraki deneyim**: kullanıcının hedefini yapılandırmak, ilgili gerçek piyasa/pozisyon verisini getirmek, yapılacak işi ve izinlerini anlaşılır biçimde göstermek, sonucu takip etmek.

Discovery, trust, comparison ve activation ürünün merkezi olmaya devam etmeli. BNB Agent Studio altyapıdır. Dört kategori — Rebalancing, Grid Trading, Yield Optimisation, Health Factor Monitoring — eşit gezinme ve geliştirme kapsamına sahip olmalı. Yeni bir Trading kategorisi ekleyerek Yield'i geri plana atmak mevcut ürün hedefini bozar.

## İncelenen akışlar ve gözlemler

| Yüzey | Doğrudan gözlem | Binera açısından sonuç |
| --- | --- | --- |
| [Marketplace](https://4lpha.tech/) | Dokuz kart, dört kategori, arama ve farklı sıralamalar var. Kartlar performans/ücret göstergeleri taşıyor. İncelenen Hire düğmesi kategori kurulumuna götürüyor; ayrı bir karşılaştırma akışı görmedim. | Kartın “ne yapar?” sorusunu hızlı yanıtlaması faydalı. Performans sayısı eklemek için hesaplama ve kaynak kanıtı gerekir. |
| [Grid kurulumu](https://4lpha.tech/deploy/grid) | Strateji önayarları, sermaye, havuz araması, çıkış eşikleri ve gelişmiş gas/RPC ayarları var. | Kategoriye uygun yapılandırılmış görev hazırlama örneği. Bizde ilk sürümde bunlar araştırma girdileri olur; emir veya stop garantisi vermez. |
| [Trading kurulumu](https://4lpha.tech/deploy/trading) | Giriş büyüklüğü, pozisyon sayısı, piyasa filtreleri, slippage, çıkışlar ve süre alanları var. Model seçimi ve Markdown talimatları da sunuluyor. | Basit/ileri ayrımı iyi. Model seçiciyi ve işlem kararını modele bırakmayı Binera'ya taşımaya gerek yok. |
| [LP kurulumu](https://4lpha.tech/deploy/lp) | Havuz seçimi, fiyat aralığı, tick görselleştirmesi, rebalance ve compound ayarları var. Havuz seçilmeden canlı tick bekleme mesajı gösteriliyor. | Mevcut tek havuz snapshot'ımızı kullanıcı hedefiyle bağlayan havuz/pozisyon incelemesi değerli. |
| [Lending kurulumu](https://4lpha.tech/deploy/lending) | İzlenecek adres, health factor eşikleri, rezerv, geri ödeme sınırı ve cooldown alanları var. İzinlerin sınırları da açıklanıyor. | Health kategorisini genel agent aramasından gerçek pozisyon değerlendirmesine taşımalıyız. |
| [Hesap](https://4lpha.tech/account) | Bağlantısız durumda owner bağlantısı, hesap oluşturma/değiştirme ve passkey seçeneği sunuluyor. Yetkili portföy görünümünü test etmedim. | Bizde hesap, fonlama ve iş yönetimi arasındaki bağ daha açık kurulabilir. |

Ek gözlem: cüzdan penceresinde WalletConnect seçeneği var; bağlantı tamamlanmadı. Mobilde kullanım desteklenmiyor mesajı gördüm. Agent listeleme kontrolü devre dışı. Hesap başına tek agent sınırlaması belirtiliyor. Binera'nın mobil görünümü ve karşılaştırması korunması gereken özellikler.

Havuz aramasının kullandığı [public API](https://4lpha.tech/api/pools) HTTP 200 döndü. Gözlenen yanıtta havuz/token adresleri, ücret katmanı, TVL/hacim/APR alanları, kaynak ve güncellik bilgisi vardı; bazı tick/likidite değerleri boştu. API'nin yanıt vermesi değerlerin bağımsız doğrulaması değildir. Bu endpoint Binera'nın üretim veri kaynağı yapılmamalı; birincil protokol kaynakları kullanılmalı.

## Görünen özellik ile çalışma kanıtı

[4lpha implementation status](https://docs.4lpha.tech/#status), 5 Eylül tarihli bir geliştirme snapshot'ı. Geçmiş mainnet işlemleriyle bütün güncel kullanıcı akışlarının hazır olmasını ayrı tutuyor. Lending tarayıcı akışı ertelenmiş; yeni LP marketplace incelemesi yayına uygun bulunmamış. Sonraki değişikliklerin bu engelleri çözüp çözmediğini doğrulamadım.

[Doküman girişinde](https://docs.4lpha.tech/) animasyonlar örnek olarak tanımlanıyor; marketplace performans sayıları kanıt kabul edilmiyor. Kartlardaki getirilerin gerçek kullanıcı sonuçları olduğunu doğrulamadım.

[Kontrol dokümanı](https://docs.4lpha.tech/#controls) pause, pozisyon kapatma ve onchain revoke'u ayırıyor. [Cüzdan dokümanı](https://docs.4lpha.tech/#wallet) ise sunucuda şifreli session anahtarıyla çalışan provisioning yolunu anlatıyor. Bunlar Binera'nın tarayıcıda geçici anahtarla araştırma işi kiralamasından farklı bir mimari gerektirir.

## Binera'nın mevcut durumu

Kaynaklar: `src/components/marketplace.tsx`, `agent-detail.tsx`, `comparison.tsx`, `activation.tsx`, `dashboard.tsx`; `src/lib/domain.ts`, `src/lib/server/studio.ts`, `chain.ts`.

| Alan | Mevcut Binera | Genişleme ihtiyacı |
| --- | --- | --- |
| Keşif | Gerçek registry, intent, asset/protocol/risk filtreleri, deterministik relevance | Paylaşılabilir arama URL'si; veriyle desteklenen sıralamalar; kaydedilen agent'lar |
| Güven | Kimlik, kaynak, feedback, bilinmeyen risk, canlı endpoint kontrolü, imzalı teklif | Kimlik/servis/teslimat kanıtını ayrı ve zaman damgalı göstermek |
| Karşılaştırma | Aynı kategoriden iki–üç agent; güncel detaylar | Aynı görev için teklif, kapsam, süre ve izin karşılaştırması |
| Aktivasyon | Dört kategoride aynı araştırma kiralama akışı; görev metni | Kategoriye özel görev girdileri, veri önizlemesi ve anlaşılır hazırlık adımları |
| Piyasa bağlamı | PancakeSwap snapshot'ı | Havuz seçimi, pozisyon okuma, ücret ve veri güncelliği açıklaması |
| Hesap/iş takibi | Fonlama, job/receipt, teslimat, dispute/settlement, revoke, public export/import | Tek ekranda durum ve sıradaki işlem; geçmişle ilişkilendirilmiş kanıt |
| Sürekli strateji yürütme | Yok; araştırma sonucu kiralanıyor | Sağlayıcı yetenek sözleşmesi, worker, kalıcı journal, anahtar saklama ve operasyon tasarımı |

## Öncelikli uygulama paketi

### 1. Dört kategori için görev hazırlama

Mevcut activation bileşenini genişlet; paralel bir ikinci işe alma sistemi kurma. Önerilen akış: **Define your task → Review live data → Compare terms → Review permissions → Confirm**.

| Kategori | İlk sürümde toplanacak girdiler | Gerçek veri ve kabul ölçütü |
| --- | --- | --- |
| Rebalancing | Havuz/pozisyon, hedef aralık, değerlendirme süresi | Factory ve chain doğrulanmış havuz; pozisyon varsa sahibi ve güncel tick. Çıktı bir rebalance araştırmasıdır. |
| Grid | Çift/havuz, bütçe bağlamı, alt/üst aralık, seviye sayısı | Pozitif sınırlar, alt < üst, token decimal kontrolü; önizleme hesaplaması canlı performans diye sunulmaz. |
| Yield | Varlık, tutar, süre, likidite ihtiyacı, izin verilen protokoller | APR/APY tanımı ve kaynağı; yalnızca veri varsa karşılaştırma. Bilinmeyen risk low-risk eşleşmesi sayılmaz. |
| Health | İzlenecek adres, lending protokolü, alarm ve hedef eşikler | Gerçek borç/teminat/sağlık verisi; borç yok, desteklenmiyor ve RPC hatası ayrı durumlar. İlk aşamada otomatik repay yok. |

Alanlar kullanıcı tarafından incelenebilir bir görev metnine dönüştürülür. İmzalı teklifteki görevle birebir bağ korunur; tekliften sonra bir girdi değişirse teklif ve onay geçersizleşir. “Strategy capital” ile “Agent fee” ve ağ ücreti ayrı gösterilir. Başka kullanıcıya ait pozisyon araştırılabilir; bu, o pozisyonu değiştirme yetkisi vermez.

### 2. Gerçek havuz ve pozisyon inceleme

Mevcut chain adapter'ını genişlet. İlk kapsam belirli bir BSC PancakeSwap v3 havuz adresini doğrulayıp okumak olabilir; tüm ekosistemi indeksleyen yeni servis kurmak gerekmez. Arama daha sonra resmi veri kaynaklarıyla eklenir.

Kabul: adres/factory doğrulaması, token decimal ve sıralaması, tek block bağlamı, gözlem zamanı, RPC hatasında açık durum. Token bakiyesinden TVL veya spot fiyattan APR türetilmez. Hacim/geçmiş APR için ayrı zaman serisi gerekir. Rakibin API'si veya ekran değerleri kullanılmaz.

### 3. Kanıt ve kullanılabilirlik durumu

Tek bir “Verified” işaretine daha fazla anlam yükleme. Ayrı göstergeler önerisi: **Registered identity**, **Service checked**, **Signed quote available**, **Completed delivery evidence**. Her biri kaynağını, neyi doğruladığını ve son kontrol zamanını açmalı.

Kabul: endpoint yayını erişilebilirlik sayılmaz; erişilebilirlik başarılı iş sayılmaz. Uptime yüzdesi ancak ölçüm aralığı ve örnek sayısı olan gerçek gözlem geçmişiyle gösterilir. Her kart için anlık ayrı ağ isteği üretme; sınırlı paralellik ve cache kullan.

### 4. Aynı görev üzerinden teklif karşılaştırması

Mevcut comparison tablosuna aynı görev girdisiyle alınmış gerçek teklifleri ekle: ücret/token, teslim edilecek çıktı, süre varsa süre, teklif son kullanımı ve izin kapsamı. Araştırma bedelini strateji getirisiyle birleştirme.

Kabul: en fazla üç sağlayıcıya kullanıcı başlatmalı istek; bağımsız hata gösterimi; süresi dolan tekliften aktivasyon yok; bilinmeyen ücret sıfır sayılmaz. Currency ve koşulları farklı teklifler otomatik “en ucuz” ilan edilmez.

### 5. Kaydetme, paylaşım ve sıralama

İlk aşamada browser'da yalnızca agent ID'lerini saklayan Saved agents eklenebilir. Arama/filtre ve comparison ID'leri URL'den yeniden kurulabilir; kişisel görev metni veya hesap bilgileri paylaşım URL'sine varsayılan olarak yazılmaz.

Sıralama seçenekleri mevcut gerçek alanlarla sınırlı: relevance, source update, feedback count. Sabit tie-breaker ve tüm sonuç kümesinde pagination öncesi sıralama korunur. Feedback sayısı kalite veya getirinin vekili diye sunulmaz. Ölçülmüş PnL ve tamamlanan iş sayısı veri gelmeden sıralama seçeneği olmaz.

### 6. Hesapta durum ve sıradaki adım

Dashboard'da account, session ve job durumlarını kullanıcıya tek yol olarak sun: fonlama gerekiyor, teklif bekleniyor, izin verilmiş, ödeme belirsiz, iş aktif, teslimat incelemesi, dispute/settlement, izin kaldırıldı. Mevcut receipt uzlaştırması ve belirsiz durumda tekrar ödeme önleme korunur.

Her kategori için açıklayıcı yardım metni ekle. Her iş satırı gerçek job, session ve transaction kanıtına bağlansın. Pozisyon PnL'si, aktif strateji veya “Pause trading” düğmesi ancak gerçek execution desteği geldiğinde eklenir.

## Sonraki aşama: gerçek otomasyon

4lpha'daki tüm ayarları çalışan gibi göstermek yeterli olmaz. Binera'nın dört kategori için otomasyon sunması istenirse önce şu bağımlılıklar çözülmeli:

1. **Sağlayıcı sözleşmesi:** desteklenen kategori/chain/protokol, yapılandırma şeması, imzalı koşullar, durum ve stop/revoke semantiği. BNB Studio metadata'sından otomatik olarak bu sözleşme varmış sonucu çıkarılmaz.
2. **Kalıcı yürütücü:** Railway web servisine ek worker; sahipliği belirlenmiş işler, idempotency, nonce yönetimi, retry ve belirsiz transaction uzlaştırması. Redeploy sırasında iki yürütücü aynı işlemi yapmamalı.
3. **Kalıcı journal ve hesap sahipliği:** DB ancak bu ihtiyaçla eklenir. İmzalı owner authentication, tenant izolasyonu ve kayıt erişimi gerekir. Wallet bağlantısı tek başına server login değildir.
4. **Session key yönetimi:** tarayıcıdaki geçici anahtarı sunucuya taşımak sıradan bir refactor değildir. Şifreli saklama/KMS, provisioning, yetki doğrulaması, iptal/expiry ve incident akışı gerekir. Seed phrase alınmaz.
5. **Zincirde uygulanan sınırlar:** spender/recipient gibi calldata parametrelerinin kontrolü ayrıca incelenir. Sunucu policy'sinin onchain garanti gibi sunulması önlenir. Pause, exit ve revoke ayrı işlemlerdir.
6. **Gerçek performans:** başlangıç/bitiş değerlemesi, yatırma/çekme ayrımı, gas/servis ücretleri, fiyat kaynakları ve block aralığı. Veri eksikse PnL yayımlanmaz.
7. **Canlı kabul:** dört kategoride ayrı fonlanmış yürütme, yeniden başlatma, başarısız tx, provider kesintisi, revoke ve teslimat/pozisyon sonucu kanıtı. Kullanıcı onayı olmadan gerçek fon hareketi yapılmaz.

Bu aşamadan önce Alerts/monitoring, salt okunur Health kontrolü ve araştırma çıktısı kalitesini artırmak daha düşük bağımlılıkla değer üretir. Kesin teslim tarihi, sağlayıcı ve permission desteği doğrulanmadan verilemez.

## İlk sprint ve doğrulama sırası

İlk sprint kapsamı: dört kategori için yapılandırılmış araştırma görevi, havuz adresi üzerinden canlı bağlam ve iş/sermaye/ücret ayrımı. Ardından aynı görevle teklif karşılaştırması, güven göstergeleri ve Saved agents. Her kategoride eşit giriş ve hata durumları tamamlanmadan bir kategoriyi otomasyon ürünü gibi öne çıkarma.

Testler: girdilerin canonical görev metnine bağlanması; girdiler değişince eski teklifin geçersizleşmesi; yanlış chain/adres/decimal ve provider hataları; compare partial failure ve expiry; mobil ve erişilebilir form akışı. Sonra build ve production origin dahil Railway smoke testi. Ödeme kanıtı olmayan test, ücretli E2E diye raporlanmaz.

Mevcut Next.js uygulaması, UI bileşenleri ve adapter'lar kullanılacak. Yeniden scaffold, ikinci frontend veya ilk sprint için gereksiz DB/worker dependency'si yok. UI İngilizce kalacak; yarışma mesajları UI'a eklenmeyecek. AI yalnızca intent çıkarımı ve açıklamada kullanılacak; agent, risk puanı, performans veya sıralama uydurmayacak.

## İnceleme kayıtları

Yerel ekran görüntüleri ve metin gözlemleri `test-results/4lpha-review/` altında; Git'e dahil edilmiyor. Kanıt kapsamı herkese açık gezinme ve read-only veri yanıtlarıdır. Ücretli işlem, owner hesabı, pause/revoke veya rakibin kapalı backend'inin güvenliği bağımsız olarak doğrulanmadı. Bu inceleme sırasında Binera production kodu ve deployment ayarları değiştirilmedi; repo private kalır.
