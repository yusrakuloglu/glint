# Supabase JWT ve JWKS

## Ne yaptık

- API, her isteğin `Authorization: Bearer <token>` başlığındaki Supabase access token'ını kendisi doğruluyor. Supabase'e her istekte sormuyor.
- Doğrulama, Supabase projesinin yayınladığı public key'lerle (JWKS) yapılıyor.
- Tüm route'lar varsayılan olarak korumalı. Açık olanlar (`/health`) `@Public()` ile işaretleniyor.

## Neden

- **Asimetrik imza:** Supabase token'ı private key ile imzalıyor, API public key ile doğruluyor. API'de token üretebilecek bir sır yok. Paylaşılan secret (HS256) sızsaydı, herkes istediği kullanıcı adına token üretebilirdi.
- **JWKS:** Key'ler bir URL'den (`/auth/v1/.well-known/jwks.json`) okunuyor. Supabase key'i değiştirdiğinde (rotation) yeni key `kid` ile ayırt ediliyor; API'yi yeniden deploy etmek gerekmiyor.
- **Değerlendirilen alternatifler:**
  - Her istekte `supabase.auth.getUser()`: her istek bir ağ çağrısı demek, rate limit'e takılabilir.
  - `@nestjs/passport`: tek bir strateji için fazladan bir soyutlama katmanı.
- Karar kaydı: [019](../decisions.md).

## Nasıl çalışıyor

1. **Key resolver ([auth.module.ts](../../apps/api/src/auth/auth.module.ts)):**
   - `createRemoteJWKSet` key'leri ilk ihtiyaçta çekip cache'liyor.
   - Bilinmeyen bir `kid` gelirse yeniden çekiyor, ama en fazla cooldown süresinde bir kez. Rastgele `kid`'lerle saldırı JWKS'e istek yağdıramıyor.
   - Resolver bir DI token'ı (`JWT_KEY_RESOLVER`) olduğu için testlerde yerel bir key ile değiştirilebiliyor.
2. **Guard ([auth.guard.ts](../../apps/api/src/auth/auth.guard.ts)):**
   - `APP_GUARD` ile global kayıtlı. Önce `@Public()` metadata'sına bakıyor.
   - Değilse `Bearer` token'ı alıyor, doğrulatıyor ve sonucu `request.user`'a yazıyor.
   - `@CurrentUser()` ([current-user.decorator.ts](../../apps/api/src/auth/current-user.decorator.ts)) bu değeri controller'a veriyor.
3. **Doğrulama (`AccessTokenVerifier.verify`, [access-token-verifier.ts](../../apps/api/src/auth/access-token-verifier.ts)):**
   - `jwtVerify` imzayı ve şu claim'leri kontrol ediyor:
     - `alg`: yalnızca `ES256`/`RS256`,
     - `iss`: `<SUPABASE_URL>/auth/v1`,
     - `aud`: `authenticated`,
     - `exp`: 5 sn toleransla.
   - Ardından payload Zod ile parse ediliyor: `sub` uuid olmalı, `role` tam olarak `authenticated` olmalı, anonim kullanıcılar reddediliyor.
4. **Hata ayrımı:**
   - jose'nin "bu token geçersiz" anlamına gelen hata kodları (süresi geçmiş, imza bozuk, algoritma izinsiz, key bulunamadı) **401** dönüyor, `WWW-Authenticate: Bearer` başlığıyla.
   - Timeout, ağ hatası ve bozuk JWKS yanıtı **503** dönüyor. Supabase'in birkaç dakikalık kesintisi client'ın kullanıcıyı oturumdan atmasına yol açmıyor.
5. **Config ([env.ts](../../apps/api/src/config/env.ts)):**
   - `SUPABASE_URL` Zod ile doğrulanıyor ve path içermemesi gerekiyor. `/rest/v1/` gibi bir path ile verilirse API açılışta hata veriyor.
6. **Testler ([auth.guard.spec.ts](../../apps/api/src/auth/auth.guard.spec.ts)):**
   - `createTestTokenIssuer` ([access-tokens.ts](../../apps/api/src/testing/access-tokens.ts)) yerelde bir ES256 keypair üretip Supabase biçiminde token imzalıyor. Testler ağa çıkmıyor.
   - Senaryolar: süresi geçmiş token, yanlış `iss`/`aud`, `anon`/`service_role` rolü, başka key ile imza, `alg: none`, HS256 karıştırması, JWKS kesintisi.

## Sınır durumları ve kısıtlar

- Token iptali anlık değil: kullanıcı çıkış yapsa bile token `exp`'e kadar (Supabase'de varsayılan 1 saat) geçerli. Anlık iptal için her istekte Supabase'e sormak gerekirdi.
- `service_role` token'ları da reddediliyor. Sunucudan sunucuya çağrı gerekirse ayrı bir yol tasarlanmalı.
- JWKS ilk istekte çekiliyor. Soğuk başlangıçta ilk korumalı istek biraz daha yavaş.
- `request.user` yalnızca `id` taşıyor. E-posta gibi bilgiler gerekirse claim şemasına eklenmeli.

## Mülakat soruları

1. JWT'yi doğrulamak ne demek, decode etmekten farkı ne?
   <details><summary>Cevap</summary>Decode, base64url ile payload'ı okumaktır; herkes yapabilir. Doğrulama, imzanın beklenen key ile atıldığını ve `iss`, `aud`, `exp` gibi claim'lerin beklentiye uyduğunu kontrol etmektir. Doğrulanmamış payload'a güvenilmez.</details>
2. HS256 ile ES256 arasındaki fark nedir, burada neden ES256?
   <details><summary>Cevap</summary>HS256 simetriktir: imzalayan ve doğrulayan aynı secret'ı bilir, doğrulayan da token üretebilir. ES256 asimetriktir: imza private key ile, doğrulama public key ile yapılır. API yalnızca public key'i bildiği için token üretemez; sızacak bir sır yoktur.</details>
3. Algoritma karıştırma (algorithm confusion) saldırısı nedir?
   <details><summary>Cevap</summary>Saldırgan token başlığına `alg: HS256` yazar ve sunucunun public key'ini HMAC secret'ı olarak kullanarak imzalar. Kütüphane başlıktaki `alg`'a güvenip public key ile HMAC doğrularsa sahte token geçer. Çözüm: kabul edilen algoritmaları sunucuda sabitlemek (allowlist). `alg: none` da aynı şekilde kapanır.</details>
4. JWKS nedir, key rotation nasıl çalışır?
   <details><summary>Cevap</summary>JSON Web Key Set: public key'lerin `kid` ile listelendiği bir JSON. Sağlayıcı yeni key'i önce listeye ekler, sonra onunla imzalamaya başlar, eskisini bir süre sonra kaldırır. Doğrulayan taraf token başlığındaki `kid` ile doğru key'i seçer; bilinmeyen `kid` görünce listeyi yeniden çeker.</details>
5. Neden JWKS'e ulaşılamadığında 401 yerine 503 dönüyoruz?
   <details><summary>Cevap</summary>401 client'a "token'ın geçersiz" der; client da kullanıcıyı çıkışa yönlendirir. Sorun token'da değil altyapıda. 503 geçici bir sorun olduğunu söyler, client tekrar dener.</details>
6. JWT'lerin iptal edilememesi nasıl yönetilir?
   <details><summary>Cevap</summary>Kısa ömürlü access token + refresh token ile pencere küçük tutulur. Anlık iptal gerekiyorsa bir denylist (`jti` veya `session_id`) ya da her istekte oturum kontrolü eklenir; ikisi de durumsuzluğun avantajını azaltır.</details>
7. Neden guard global ve açık route'lar işaretli, tersi değil?
   <details><summary>Cevap</summary>Varsayılan güvenli olsun diye (secure by default). Yeni bir endpoint'te auth'u unutmak veriyi açar; `@Public()`'i unutmak sadece 401 döndürür ve hemen fark edilir.</details>

## Kendini test et

- Bir isteğin `Authorization` başlığından `@CurrentUser()`'a kadar geçtiği adımları anlat.
- `iss`, `aud`, `exp`, `sub` ve `role` claim'lerinin her birini neden kontrol ettiğimizi açıkla.
- Testlerde gerçek Supabase'e gitmeden token'ları nasıl ürettiğimizi ve doğruladığımızı anlat.
- Hangi hatanın 401, hangisinin 503 olduğunu ve nedenini açıkla.
