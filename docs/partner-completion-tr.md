# Partner kanıtlarını tamamlama ve Railway ayarları

## Şimdi nerede duruyoruz?

Ürün çalışıyor; bu, partnerlerin gerçek işlem ve çıktı kanıtlarının tamamlandığı anlamına gelmiyor. Docs kullanıcı rehberi olarak yeniden yazıldı. Başvuru raporları yalnızca `submission/` altında; ürün arayüzünde yarışma anlatımı yok.

`binera.xyz` DNS ve TLS doğrulaması geçti. Eski passkey hesabını Railway adresinden kullanmaya devam et; domain değiştirmek hesabı veya bakiyeyi taşımaz.

## Railway Variables

Binera servisi → Variables bölümünde:

Kontrolde `SCAN_API_KEY` zaten tanımlıydı. Değeri okunup rapora yazılmadı; tekrar eklemene gerek yok. OpenAI ve TermiX değişkenleri tanımlı değildi ve temel marketplace akışı için zorunlu değiller.

```dotenv
APP_ORIGIN=https://binera.xyz
APP_ADDITIONAL_ORIGINS=https://binera-production.up.railway.app
BSC_RPC_URL=https://bsc-dataseed.bnbchain.org
```

`APP_ORIGIN` ve ek origin ayarlarını bu çalışma kapsamında servise uyguluyoruz. `BSC_RPC_URL` zaten varsa kullandığın özel RPC'yi koru. Ana domain ve Railway adresi birlikte izinli kalmalı.

| Değişken | Ne zaman eklenir? | Değer |
| --- | --- | --- |
| SCAN_API_KEY | Yoğun keşif için önerilir | 8004scan Developer Hub'dan aldığın gerçek API key |
| BSC_RPC_URL | Public RPC kotası yetmezse | BSC mainnet destekleyen sağlayıcının HTTPS RPC URL'si |
| OPENAI_API_KEY | İsteğe bağlı doğal dil yorumlama | Kendi OpenAI API key'in; agent listesi veya ranking üretmez |
| OPENAI_MODEL | OpenAI kullanılıyorsa | Mevcut varsayılan `gpt-4.1-mini`; hesabındaki model erişimini kontrol et |
| MARKETPLACE_AGENT_IDS | Özellikle dahil edeceğin gerçek kimlikler varsa | Virgülle ayrılmış `scan-56-...` kimlikleri; boş bırakılabilir |
| STUDIO_AGENT_URLS | Kendi yayındaki BNB Agent Studio servislerini ekliyorsan | Virgülle ayrılmış gerçek HTTPS agent-card URL'leri; boş bırakılabilir |
| TERMIX_MCP_URL / TERMIX_MCP_TOKEN | Yalnızca gerçekten kurulu MCP servisin varsa | Servis adresi ve gerekiyorsa token; TermiX ödülü için zorunlu değil |

`TERMIX_COMMAND` ve `TERMIX_ARGS` yalnızca sunucuda kurulu stdio MCP kullanılıyorsa gerekir. Railway'e bilgisayarındaki Windows dosya yolunu yazma. Çalışmayan örnek URL veya sahte key ekleme. Bu uygulama için `ALTANA_PRIVATE_KEY`, passkey, seed phrase veya kullanıcı cüzdan anahtarı gerekmez; bunları Variables'a ekleme. `STUDIO_AGENT_URLS` bir agent deploy etmez; mevcut servisi katalog kaynağı olarak tanımlar.

8004scan Pro erişimi için [Developer Hub](https://8004scan.io/developers) üzerinden key oluştur, ardından [erişim formunu](https://forms.gle/jQevEPCAacBXaKG79) doldur.

## Gerçek teslimatlar: senin yapacağın kısa akış

1. Bakiyeli hesabı orijinal Railway domaininde aç. Son gözlemde 1.8685 U ve yaklaşık 0.0000351 BNB var. BNB gerçek relay/işlem maliyetini karşılamayabilir; hata gerçek ücret eksikliğini gösterirse doğru marketplace adresine BSC üzerinden BNB ekle. Sabit bir ücret tahmini verilmez.
2. Dört kategorinin her birinde bir gerçek görev için güncel teklif al. Fiyatı okuyup passkey ile onayla. Bekleyen bir iş varsa önce onu kontrol et; tekrar ödeme yapma.
3. My agents içinde teslimatı iste, raporu oku, kaynakları kontrol et. Uygunsa ilgili sözleşme adımıyla tamamla; uygun değilse süre dolmadan dispute seçeneğini değerlendir.
4. My agents içinden public iş geçmişini dışa aktar. Dosyada özel anahtar gerekmez. Job ID ve grant/funding/revoke hash'lerini de sakla.
5. Dosyayı workspace'e koy ve gerçek job ID'lerini kategoriye eşleyen bir JSON oluştur; örneğin `{ "GERCEK_JOB_ID": "rebalancing" }` biçimini gerçek sayısal kimlikle doldur. Kategoriler: `rebalancing`, `grid`, `yield`, `health`.

```powershell
npm run collect:evidence -- --input ./activity.json --mapping ./job-categories.json
```

Araç zinciri ve teslimat hash'ini okur; ödeme yapmaz. Yeni dosyada doğrulanmış `categoryEvidence` adaylarını ve işlem gözlemlerini üretir; mevcut release manifestini değiştirmez. Çıktı kalitesi ve receipt-job ilişkisi incelendikten sonra adayları `submission/release.json` içine işle. Henüz teslim edilmeyen işler eksik olarak kalır.

## Altana

İzin verme → session ile iş fonlama → erişimi kaldırma akışını gerçek işlemle göster. Üç işlem hash'i, wallet adresi, Keystore kaydı ve Altana explorer bağlantısını rapora koy. Geçersiz bir anahtar tek başına revoke kanıtı değildir; expiry olabilir.

Ek olarak agent'ın **kendi Altana wallet** adresi ve bu wallet'tan sınırlı session ile çalıştığı kanıtı gerekir. Bizdeki alıcı hesabı bunun yerine geçmez. Gerçek sağlayıcıdan public wallet/işlem referanslarını al veya kendi agent'ını ayrı Altana wallet ile çalıştır. Hazır rapor: `submission/altana-evidence.md`.

## TermiX

Üç görevi iki şekilde yap: önce agent kullanmadan bağımsız çalışma, sonra aynı girdilerle Binera'dan agent kiralama. Her iki tarafta başlangıç/bitiş, maliyet ve ham çıktıyı kaydet. En az bir görev trading/stock/security olmalı. Grid araştırması trading görevi olarak seçildi; gerçek trading geçmişi varmış gibi sunulmaz. Raporun deney kartları `submission/agent-advantage-report.md` içinde.

Her çıktıyı aynı beş ölçütle 0–4 puanla; değerlendiren kişinin adını ve gerekçesini ekle. Sonuç kötü veya yavaşsa bunu da yaz. Bu insan baseline'ını benim agent olarak yazmam, bağımsız agentsız karşılaştırma sayılmaz. TermiX API anahtarı bu raporun yerine geçmez.

## PancakeSwap

Hazır görev ve gerçek havuz snapshot'ı `submission/pancakeswap-benefit-report.md` içinde. Görevi Binera üzerinden çalıştır; manuel çalışmayla süre, maliyet ve doğru/eksik bulguları karşılaştır. Kaynaklı LP karar desteğini ölç; otomatik likidite yönetimi veya kâr elde edildiğini iddia etme. Aynı deney TermiX'in üç görevinden biri olabilir.

## Son kontrol

Raporları jüri erişimine aç, gerçek URL'lerini `submission/release.json` alanlarına ekle. Repo kullanıcı tercihiyle private kalır; jüri erişimini ayrıca sağla veya daha sonra public yap. Ardından `npm run check:release` çalıştır. Geçmeyen maddeyi tamamlanmış diye sunma. Ana track'in dört kategoride otomasyon derinliği beklentisi mevcut araştırma akışından daha geniştir; bu farkı başvuruda açıkça belirt.

Resmî kaynak: https://www.bnbchain.org/en/hackathons/smart-money-era?tab=tracks
