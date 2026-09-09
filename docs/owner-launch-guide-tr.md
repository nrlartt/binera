# Başvuru ve canlı yayın: senin tamamlayacağın adımlar

Bu dosya uygulama kodundan sonra gereken hesap, imza ve kanıt işlerini anlatır. Build'in geçmesi bunların tamamlandığı anlamına gelmez. Şifre, seed phrase, private key veya API token'ı sohbete göndermemelisin.

## 1. Zaman ve organizasyon

[Resmi kayıt formu](https://docs.google.com/forms/d/e/1FAIpQLSdFb30r24sZcFJVDbMqXNJ1_45BJHanc7eFqwUniScDYZfX9A/viewform) build bitişini **9 Eylül 2026 12:00 UTC / Türkiye 15:00** olarak veriyor. Form adı Registration. Nihai teslimin aynı formdan mı yoksa başka bir kanaldan mı yapıldığını, Altana seçeneği formda görünmediği için partner katılımının nasıl bildirileceğini organizatörle teyit et. Formu ben göndermedim; katılım şartlarını ve ödül adresini sen onaylamalısın.

Hazırlayacağın kişisel bilgiler: ekip/solo tercihi, isim ve roller, e-posta, Telegram/X, ülke-saat dilimi, ödül için ERC-20/BEP-20 uyumlu adres. Ödül adresi uygulamadaki marketplace hesabı olmak zorunda diye bir varsayım yapma; kontrol ettiğin ve organizatörün istediği ağla uyumlu adresi kullan.

## 2. GitHub ve yayın erişimi

Önce proje için GitHub'da bir repo oluştur veya mevcut URL'yi paylaş. Kendi bilgisayarındaki terminalde Vercel'i bağla:

```powershell
Set-Location 'C:\Users\user\Desktop\agentmarket'
npx vercel login
```

CLI'nin açtığı doğrulamayı kendi hesabında tamamla. Ardından repo URL'sini, kalıcı domain'i ve hangi Vercel projesine yayınlanacağını belirt. Deploy erişimi geldikten sonra otomatik olarak yapılabilecek işlem:

```powershell
npx vercel --prod
```

CLI'nin team/project sorularında bu ürünün projesini seç. Şirketindeki başka projeyi yanlışlıkla üzerine yazma. Domain henüz yoksa tek bir sabit `proje.vercel.app` adresi başlangıç için kullanılabilir; sürekli değişen preview URL'sinde production hesabı oluşturma.

`NEXT_PUBLIC_` ile gizli değer ekleme. `.env.example` rehberdir; gerçek anahtarlar Vercel Environment Variables altında saklanır. Mevcut minimum uygulama OpenAI veya TermiX olmadan çalışır. 8004scan yoğun kullanımı için `SCAN_API_KEY`, güvenilir RPC için `BSC_RPC_URL` tanımlanması önerilir. TermiX MCP, ilgili ödüle katılmanın zorunlu entegrasyonu değildir.

## 3. Production passkey hesabı

Passkey'ler site origin'ine bağlıdır. Localhost'ta oluşturduğun hesabı production domain'inde aynı passkey ile açabileceğini varsayma.

1. Localhost'taki hesap adresini ve varsa public işlem kayıtlarını dışa aktar. Bakiyesi/aktif izni varsa onları o origin'de yönet; eski hesabı kaybolmuş gibi terk etme.
2. Kalıcı HTTPS URL'sini aç. `Connect wallet` ile Rabby/MetaMask'i bağla; uygulama ağı algılar.
3. `Create a passkey account` veya o production origin'inde mevcutsa `Use an existing passkey` kullan. Tarayıcının passkey penceresini sen onaylarsın.
4. Bağlı dış cüzdan ile marketplace hesabının farklı adresler olduğunu kontrol et. Fonlama hedefi **marketplace hesabıdır**.
5. `Resume an account saved on this device`, ilk zincir işleminden önce aynı tarayıcıda saklanan public passkey handle'ını kullanır. Tarayıcı verisini silmeden önce bunu dikkate al.

## 4. Küçük tutarlı gerçek fonlama

BNB ağ ücretleri içindir. Agent ücreti uygulamanın SDK'sındaki **U** token'ıyla ödenir; USDT göndermek U bakiyesini artırmaz.

İncelenen SDK'nın BSC mainnet U adresi:
`0xcE24439F2D9C6a2289F741120FE202248B666666`

Bu adresi kaynak ve cüzdan token bilgisiyle karşılaştır. Bu rehber belirli bir platformdan token satın almanı istemez; U yoksa kaynağını sağlayıcı/organizatörle doğrula. Testnet token'ını mainnet hesabına geçerli ödeme sanma.

1. Uygulamada hedef hesabı kopyala ve cüzdandaki transfer hedefiyle karşılaştır.
2. Yalnızca denemek istediğin tutarı gir. BNB için `Review transfer in wallet` seç.
3. Yanlış ağdaysan BNB'ye geçiş cüzdan onayı açılır. Ağ onayı para göndermez; transfer ayrıca cüzdanda onaylanır.
4. `Funding history → Check receipt` ile makbuzu doğrula. Confirmed görünmeden aynı transferi tekrarlama.
5. U için ayrı transfer yap. Bilinmeyen durumda kendi cüzdan geçmişindeki tx hash'ini uygulamaya girerek uzlaştır. “No transfer was sent” seçeneğini yalnızca gerçekten yayınlanmadığını kontrol ettiysen kullan.

Harcama senin imzan olmadan yapılamaz. Tam denemenin bütçesi canlı teklif + hesap/relay/ağ ücretleri + olası settlement/revoke ücretlerinden oluşur; toplam garanti bir rakam verilmiyor.

## 5. Gerçek işe alma ve sonuç kanıtı

Her kategori için mevcut tarama sonucu `submission/evidence/service-audit.json` dosyasında. `compatible`, yalnızca bu uygulamanın protokol kontrolünü ifade eder; doğru çıktı garantisi değildir. `unconfirmed`, özellikle kota veya ağ hatasında “agent çalışmıyor” demek değildir. Yayımlanmış kategori metni de kanıtlanmış otomasyon değildir.

1. Kategoriden agent seç; gerekiyorsa iki agent'ı karşılaştır.
2. `Review activation` ekranında canlı servis kontrolünü bekle. Desteklenmiyorsa fonlama/ödeme yapma; gerçekten uyumlu sağlayıcı gerekir.
3. Açık ve ölçülebilir görev yaz. Görev ve anlaşma zincirde herkese açık olabilir; gizli bilgi koyma.
4. İmzalı teklifi al; satıcı, fiyat, çıktı şartları ve süreyi incele. Şu an uygulama **araştırma görevi** kiralar. Otomatik LP yönetimi/grid/yield yönlendirme/pozisyon koruması yaptığını başvuruda yazma.
5. İzin onayını ve passkey isteğini tamamla. Sonuç belirsizse `My agents → Activity → Check payment submission` kullan; yeniden ödeme başlatma.
6. Job ID, grant/funding tx, satıcı adresi ve iş sonucunu kaydet.
7. `Read verified deliverable` göründüğünde gerçek çıktıyı incele. Hash'in doğrulanması, içerik kalitesini doğrulamaz.
8. Dispute deadline'ı izle. Uygulama sözleşmedeki pencereyi okur; settle/dispute düğmeleri o duruma göre açılır. Kalite sorunu varsa geçerli pencere içinde hareket et. Settlement penceresi kapanış saatine yetişmeyebilir; tamamlanmamış işi completed diye sunma.
9. `Permissions → Revoke access` ile izni kaldır; explorer makbuzunu kaydet. Zaten ödenmiş escrow'u revoke geri almaz.
10. Public references export'unu sakla. Başka tarayıcıda aynı marketplace hesabını bağladıktan sonra `Import public references` ile geri yükleyebilirsin.

Gerçek otomasyon kategorilerinde yeterli canlı sağlayıcı yoksa bu bir UI eksikliği değil, başvuru kapsamı engelidir. Organizatör/sağlayıcıdan çalışan endpoint, kayıt ID'si, test bütçesi ve entegrasyon şartları alınmalı; sağlayıcıyı benim uydurmam çözüm değildir.

## 6. Kanıt manifestini doldurma

`submission/release.json` içindeki boş değerler bilerek boştur. Public URL, repo ve seçtiğin track'leri yaz. Her kategoriye gerçek iş kanıtı ekle; aşağıdaki alanlar bir şemadır, gerçek değer uydurulmamalıdır:

- category: `rebalancing`, `grid`, `yield` veya `health`.
- jobId, wallet, provider, quote (export'taki tam signed description), price (en küçük U birimi).
- fundingTx: gerçek ödeme işlemi.
- outputUrl: gerçek teslimatın incelenebilir public kopyası veya kaynak URL'si.

Altana seçersen `sessionEvidence` içine wallet, grantTx, executionTx, revokeTx ve bunların gerçekten hangi yetkileri gösterdiğini anlatan explanationUrl ekle. `reviewedBy`, kanıtları inceleyen kişinin adıdır; otomatik doldurulmaz.

```powershell
npm run check:release
```

Eksikler `submission/evidence/release-check.json` dosyasına yazılır. Kontrolün tamamlanmış iş araması bizim başvuru hazırlık eşiğimizdir; organizatörün yayımladığı her koşulun birebir otomatik tercümesi değildir. Tx makbuzunun başarılı olması, tek başına doğru session ile doğru işi yaptığını kanıtlamaz; semantik inceleme gerekir. Script BSC mainnet'i kontrol eder. Altana testnet kanıtı ayrı doğrulanıp belgelenmelidir.

## 7. Partner kanıtları ve teslim

`submission/agent-advantage-report.md` gerçek ölçümler için hazırlanmış boş deney planıdır; tamamlanmış rapor değildir. Üç görevi agent ile ve agentsız yap; aynı girdileri kullan; süre, ücret/ağ maliyeti ve kaliteyi ölç; ham çıktıları ekle. En az bir görev trading/equities/security alanında olmalı. [TermiX resmi koşulları](https://www.agent.family/campaigns/bnb-build-the-era)

PancakeSwap için fiyat kartını göstermek yerine bir trader/LP görevinde somut faydayı belgelemek gerekir. Bu fayda araştırma süresi veya karar için gereken kanıtın kalitesi olabilir; garantili getiri iddiası olamaz. [Resmi yarışma açıklaması](https://www.bnbchain.org/en/blog/build-the-era-build-the-official-bnb-agent-studio-marketplace)

Son teslimde: URL, repo/sürüm, doğru ürün açıklaması, kısa gerçek ekran kaydı, gerçek iş/tx kanıtları, seçilen partner raporları ve bilinen sınırlar. `submission/project-description.md` hazır İngilizce metin taslağıdır; tamamlanmayan yetenekleri varmış gibi ekleme. Video öneridir; kayıt formunda ayrıca zorunlu olduğunu varsaymıyoruz.

## 8. Değerlendirme boyunca çalışma

Public `/api/health` gerçek RPC/registry sağlığını kontrol eder, sorun varsa 503 döner. Bir uptime servisinde bu URL'yi 2–5 dakika arayla izle; alarm alıcısını sen belirle. Vercel WAF/rate limit ve provider kotalarını deployment hesabında ayarla. Process içi limit birden çok instance için ortak kota değildir. Domain/RPC/API anahtarı değiştirildiğinde yeniden smoke test yap. Rollback için son test edilmiş commit/deployment'ı sakla.
