# Partner kaynakları ve gerçek tamamlanma durumu

İnceleme: 9 Eylül 2026. Kaynak: [yarışmanın Resources sayfası](https://www.bnbchain.org/en/hackathons/smart-money-era?tab=resources). Bu belge entegrasyon koduyla gerçek kullanım kanıtını ayrı değerlendirir.

## U nereden temin edilir?

U, United Stables token'ıdır; USDT değildir. Binera'nın BSC mainnet ödeme sözleşmesi SDK'dan okunur:

`0xcE24439F2D9C6a2289F741120FE202248B666666`

1. Hesabında kullanılabiliyorsa [Binance U/USDT piyasası](https://www.binance.com/en/trade/U_USDT) bir temin yoludur. Alım miktarı, minimumlar, ücretler ve BNB Smart Chain çekim desteğini kendi hesabında kontrol et. Çekim ağı kapalıysa başka bir ağa gönderme.
2. Alternatif olarak [PancakeSwap](https://pancakeswap.finance/swap) üzerinde BSC cüzdanını bağla, çıkış token'ını yukarıdaki sözleşmeyle seç ve güncel rotayı incele. Binera swap yapmaz; alınacak miktar, fiyat etkisi, token izni ve işlemi sen onaylarsın. Canlı teklif yoksa swap varmış gibi kabul etme.
3. U'yu **marketplace hesabına** gönder. Rabby/MetaMask adresi ile Altana passkey hesap adresi farklıdır. Önce dış cüzdanına aldıysan Binera fonlama panelinde U seçerek doğru hedefe aktar.
4. Marketplace hesabında ağ/relay işlemleri için BNB de gerekir. Testnet faucet BNB veya U varlıkları mainnet satıcıya ödeme yapmaz. BNB için gösterilen izin tavanı gerçek ücret tahmini değildir.

U kimliği: [United Stables](https://www.u.tech/), [Binance resmî token tablosu](https://github.com/binance/binance-skills-hub/blob/main/skills/binance-web3/binance-agentic-wallet/SKILL.md), [BscScan](https://bscscan.com/token/0xcE24439F2D9C6a2289F741120FE202248B666666). U temin yardımı hem fonlama panelinde hem public Docs içinde bulunur.

## Binance Agentic Wallet

Bu bilgisayara resmî `binance-agentic-wallet` Codex becerisi ve `@binance/agentic-wallet@1.9.0` CLI kuruldu. Beceri sonraki Codex turunda kullanılabilir. Kurulum siteye Binance oturumu eklemek veya kullanıcı cüzdanını Railway'e taşımak değildir. Binera'nın tarayıcı içindeki ödeme hesabı hâlâ Altana'dır.

Bağlantı ayrı Binance uygulaması onayı gerektirir. Giriş kodu zaman aşımına uğrarsa yeni akış başlat:

```powershell
baw auth signin --json
# Dönen urlForWeb bağlantısını aç; pairingCode ile uygulamadaki kodu karşılaştır.
# Dönen gerçek qrCodeId değerini aşağıda kullan:
baw auth verify --qrCodeId GERCEK_QR_CODE_ID --json
baw wallet status --json
```

`auth verify` bitene kadar terminali açık tut. Uygulamada görünen başarı yerine CLI'daki CONNECTED durumunu doğrula. Oturum/anahtar dosyalarını GitHub'a veya Railway'e koyma. Günlük limitler ve güvenlik tercihleri Binance uygulamasında ayarlanır. Binance'in MPC/API izinleri Altana Keystore kayıtlarının yerine geçmez. Bu yerel araç kurulumu, herkese açık bir Binance Agentic Wallet web entegrasyonu veya otonom satıcı kanıtı değildir. [Resmî kurulum](https://developers.binance.com/en/docs/products/agentic-wallet/quickstart/install-agentic-wallet).

## 8004scan: büyük kayıt havuzu, küçük işe alınabilir katalog

Canlı `/api/v1/stats/global` sorgusunda BSC için 311.467 kayıt, 29.400 A2A metadata kaydı, 5.646 MCP metadata kaydı gözlendi. Bunlar 9 Eylül tarihli gözlemdir; arayüzdeki sayılar canlı kaynaktan yenilenir. A2A/MCP kümeleri örtüşebilir. Metadata servis erişilebilirliği, imzalı teklif, başarılı teslimat veya kaliteyi kanıtlamaz.

Binera iki alanı ayırır: servis uyumluluğu kontrol edilen küçük Research marketplace ve sınırlı arama penceresini gösteren Browse registry. Registry ekranına kaynaklı toplamlar eklendi; 15 dakika cache kullanılır. Tüm yüz binlerce kaydı taramak, API kotasını tüketip işe alınabilirliği kanıtlamaz.

Kaynak sayfası katılımcı erişimini 500/dakika ve 100.000/gün diye açıklıyor. [Güncel Developer Hub](https://8004scan.io/developers) ise Free için 600/dakika, 100.000/gün; Pro için 3.000/dakika, 3.000.000/gün gösteriyor. Anonim canlı yanıt başlıklarında 30/dakika ve 1.000/gün görüldü. Hesabına uygulanacak gerçek kota yanıt başlıkları ve sağlayıcı onayıyla belirlenir.

Senin adımın: Developer Hub'da API anahtarı oluştur, [Pro upgrade formunu](https://forms.gle/jQevEPCAacBXaKG79) kendi bilgilerinle gönder, anahtarı Railway Variables içindeki `SCAN_API_KEY` alanına gir. Anahtarı sohbete veya `NEXT_PUBLIC_` değişkenine koyma. Mevcut backend zaten bu anahtarı kullanıyor; ek SDK gerekmez.

## Partnerlere göre kapanması gerekenler

| Partner | Çalışan kod | Gerçek kanıt için kalan |
| --- | --- | --- |
| Altana | ERC-8183 buyer SDK, çağrı allowlist'i, U/BNB harcama tavanı, 15 dakika süre, kayıtlı session, izin görüntüleme ve revoke akışı | Gerçek grant/execute/revoke makbuzları; satıcının kendi Altana cüzdanına sahip olduğunu ve kendi session anahtarıyla işlem yaptığını gösteren kanıt. Alıcı oturumu tek başına satıcı otonomisini kanıtlamaz. |
| TermiX | Marketplace'ten gerçek imzalı teklif ve ücretli araştırma akışı | En az üç görevde aynı girdilerle agent/insan karşılaştırması; süre, tüm maliyetler, ortak kalite değerlendirmesi ve iki tarafın ham çıktıları. En az biri trading/equities/security. MCP kurmak raporun yerini tutmaz. |
| PancakeSwap | Factory doğrulamalı v3 pool okuma, sabit bloktaki canlı bağlam ve LP görev girdileri | Gerçek havuz üzerinde agent'ın trader/LP'ye faydasının ölçülmesi. Spot fiyat göstermek veya testlerin geçmesi tek başına fayda kanıtı değildir. |

Altana için [SDK](https://docs.altana.network/sdk/erc8183), [sessions](https://docs.altana.network/concepts/sessions) ve [resmî beceriler](https://skills.altana.network/) kullanılabilir. Mevcut satıcıdan cüzdan adresi, kayıtlı session public key'i ve işlem referansları alınmadan onun adına key üretip sahiplik iddia etmiyoruz. x402 server SDK bonus seçenektir; ana ERC-8183 akışının doğrulanmasından önce ikinci ödeme protokolü eklenmedi.

Tüm partnerler hedeflendiği için release manifestinde `altana`, `termix` ve `pancake` kontrolleri etkinleştirildi. Eksik kanıt alanları boş kalır ve `npm run check:release` bunları BLOCKED gösterir. [Deney planı](../submission/agent-advantage-report.md) ve [sahip rehberi](owner-launch-guide-tr.md) sonraki gerçek işlerin kaydı için kullanılır.
