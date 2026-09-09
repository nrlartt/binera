# Railway yayını

Proje: **Binera**. Site başlığı: **Binera Agent Market**. Kaynak repo: [nrlartt/binera](https://github.com/nrlartt/binera). Yerel klasörün mevcut `agentmarket` adı komutlardaki dosya yoludur.

Repo kökündeki `railway.json`, mevcut Dockerfile ile Node 22 standalone image üretir. Çalıştırma komutu `node server.js`; container içinde `npm start` override'ı kullanma. Uygulama `0.0.0.0` üzerinde `PORT` değişkenini dinler. Aşağıdaki kurulum portu 3000 olarak sabitler. Yeni uygulama dependency'si, veritabanı veya volume gerekmez.

## 1. Hesabı bağla

PowerShell'de:

```powershell
Set-Location 'C:\Users\user\Desktop\agentmarket'
npx --yes @railway/cli@5.49.6 login
```

Tarayıcıdaki Railway girişini tamamla. Bu komut Railway CLI'yi çalıştırır; uygulamanın package.json dosyasına eklemez.

**Yeni Railway projesi** için:

```powershell
npx --yes @railway/cli@5.49.6 init --name binera
npx --yes @railway/cli@5.49.6 add --service binera
```

**Mevcut Railway projesi** için yukarıdaki iki komut yerine şunu kullan; doğru workspace, project, environment ve service'i seç:

```powershell
npx --yes @railway/cli@5.49.6 link
```

Aşağıdaki komutlar servis adının `binera` olduğunu varsayar. Mevcut servisin farklıysa adı değiştir.

## 2. Değişkenleri ayarla ve yayınla

```powershell
npx --yes @railway/cli@5.49.6 variable set --service binera --skip-deploys "NODE_ENV=production" "HOSTNAME=0.0.0.0" "PORT=3000" "BSC_RPC_URL=https://bsc-dataseed.bnbchain.org"
npx --yes @railway/cli@5.49.6 up --service binera
npx --yes @railway/cli@5.49.6 domain --service binera --port 3000
```

Son komut gerçek HTTPS adresini verir. `up` mevcut klasörü yükler; GitHub bağlantısı zorunlu değildir. `.env.local` Git ve Docker kapsamı dışında kalır. Railway'e dosya olarak yükleme; anahtarları servisin **Variables** ekranına gir.

| Değişken | Kullanım |
| --- | --- |
| `SCAN_API_KEY` | Yoğun kullanım için önerilir; anonim 8004scan erişiminin kotası düşüktür. |
| `BSC_RPC_URL` | Yukarıda public BSC RPC tanımlanır. Production için kendi sağlayıcının HTTPS RPC adresini kullanabilirsin. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | İsteğe bağlı intent interpretation. Anahtar yoksa kurallar çalışır; ranking deterministiktir. Model örneği `.env.example` içinde. |
| `STUDIO_AGENT_URLS` | İsteğe bağlı gerçek Studio A2A card HTTPS URL'leri; virgülle ayır. |
| `TERMIX_MCP_URL`, `TERMIX_MCP_TOKEN` | Gerçek uzak TermiX MCP köprüsü sağlandıysa tanımla. |

Gizli anahtarları komut geçmişine veya `NEXT_PUBLIC_` değişkenlerine koyma. Boş değerleri eklemen gerekmez. Container TermiX stdio server'ını içermez; bu kurulumda `TERMIX_COMMAND` tanımlamak tek başına onu kurmaz. Uzak MCP köprüsü ayrı çalışmalıdır.

## 3. Yayını doğrula

Railway çıktısındaki adresi aşağıya yaz:

```powershell
$marketUrl = 'https://RAILWAY-CIKTISINDAKI-ADRES'
(Invoke-WebRequest -Uri $marketUrl).StatusCode
Invoke-RestMethod -Uri "$marketUrl/api/health" | ConvertTo-Json -Depth 6
```

Ana sayfa 200 dönmeli; `/api/health` RPC ve registry kullanılabilirliğini bildirir, sorun varsa 503 döner. Railway açılış kontrolünün geçmesi tüm entegrasyonların çalıştığı anlamına gelmez. Harici uptime izlemesini `/api/health` adresine kur. Railway healthcheck'i sürekli monitoring değildir.

Kalıcı HTTPS adresinde discovery, compare, wallet bağlantısı ve ağ değişimini dene. Passkey hesabını kullanacağın kalıcı origin'de oluştur: localhost veya başka domain'deki passkey'in burada açılacağını varsayma. Gerçek ödeme, teslimat ve revoke kanıtları için [başvuru rehberini](owner-launch-guide-tr.md) takip et. URL'yi `submission/release.json` içine kaydet ve `npm run check:release` çalıştır.

## 4. Sonraki yayınlar ve GitHub

Değişikliklerden sonra aynı klasörde `npx --yes @railway/cli@5.49.6 up --service binera` çalıştır. Otomatik yayın istersen repoyu GitHub'a push et, Railway servisinin Source ayarlarında repo/branch bağla ve root directory'yi repo kökü olarak bırak. `railway.json` ile Dockerfile'ı commit et. Railway hesabında gerekli GitHub erişimini sen verirsin.

İlk yayında tek replica kullan. Bellekteki cache ve rate limit replica'lar arasında paylaşılmaz; kapasite artırırken ortak rate limit/ingress korumasını ayrıca kur. Railway kullanım bütçesi ve provider kota alarmlarını ayarla. Deployment loglarını ve son çalışan sürümü rollback için sakla.

Yerelde CLI 5.49.6 komutları doğrulandı. `railway.json` resmi JSON şemasından geçti; mevcut standalone build `0.0.0.0:3107` üzerinde ana sayfa ve JavaScript asset için HTTP 200 verdi. Docker Desktop engine çalışmadığı için container build bu makinede doğrulanamadı; Railway build/deploy logları yayın sırasında kontrol edilmeli. Bu rehber hazırlanırken Railway'de public deployment oluşturulmadı.

Kaynaklar: [Railway CLI](https://docs.railway.com/cli), [Dockerfile](https://docs.railway.com/builds/dockerfiles), [config reference](https://docs.railway.com/config-as-code/reference), [healthcheck](https://docs.railway.com/deployments/healthchecks).
