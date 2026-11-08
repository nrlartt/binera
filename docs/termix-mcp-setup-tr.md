# TermiX BSC MCP kurulumu (yerel stdio sunucusu)

Bu adımlar, Research desk'teki **Token scan** kartını canlı hale getirmek için yapıldı. Sunucu yalnızca salt-okunur `Token_Security_Check` aracı için kullanılıyor; cüzdan/private key **gerekmiyor ve verilmemeli**.

## 1. Sunucuyu edin ve derle

```powershell
git clone --depth 1 https://github.com/TermiX-official/bsc-mcp.git C:\Users\user\Desktop\bsc-mcp
cd C:\Users\user\Desktop\bsc-mcp
npm install --no-audit --no-fund
npm run build
```

Not: Upstream derleme çıktısındaki göreli ESM import'ları `.js` uzantısı içermiyor (`ERR_MODULE_NOT_FOUND`). Derlemeden sonra `build/**/*.js` içindeki `from "./x"` benzeri import'lara `.js` eklenmelidir. Bu düzeltme yalnızca yerel klonda yapılır, uygulama kodunu etkilemez.

## 2. Binera'ya bağla (`.env.local`, git tarafından yok sayılır)

```ini
TERMIX_COMMAND=node
TERMIX_ARGS=["C:/Users/user/Desktop/bsc-mcp/build/index.js"]
```

Alternatif olarak HTTPS köprüsü için `TERMIX_MCP_URL` (+ gerekirse `TERMIX_MCP_TOKEN`) kullanılabilir.

## 3. Yeniden başlat ve doğrula

```powershell
# dev sunucusunu yeniden başlat (env değişikliği)
Invoke-RestMethod "http://localhost:3000/api/research/security?token=0x55d398326f99059fF775485246999027B3197955"
```

Beklenen: `source: TermiX BSC MCP / GoPlus` ve GoPlus bulguları. Sağlayıcı yoksa API 503 ve "token research is not connected yet" mesajı döner — bu durumda hiçbir bulgu uydurulmaz.

## Güvenlik sınırları

- Sunucu istemci tarafından değil, yalnızca operatör env'i ile başlatılır; kullanıcı URL/komut veremez.
- `BSC_WALLET_PRIVATE_KEY` **tanımlanmamalıdır**; adapter yalnızca `Token_Security_Check` çağırır.
- Çıktı "untrusted publisher data" olarak işaretlenir ve düz metin olarak render edilir; yatırım tavsiyesi veya güvenlik garantisi sayılmaz.
- MCP sunucusu 18.000 karakterle sınırlanır (adapter tarafı).
