# Problem Details (RFC 9457)

## Ne yaptık

- API'den dönen her hata, RFC 9457'nin tanımladığı `application/problem+json` biçiminde.
- Tek bir global exception filter, gelen hata ne olursa olsun bu biçime çeviriyor.
- Her istek bir `requestId` alıyor. Bu kimlik hem yanıtta hem loglarda görünüyor.

## Neden

- **Tutarlılık:** Nest'in varsayılan hata biçimi (`{ statusCode, message, error }`) bir standarda dayanmıyor; `message` bazen string, bazen dizi. Client her hata için ayrı kod yazmak zorunda kalıyor.
- **Standart:** RFC 9457 hazır bir sözleşme. Kendi zarf formatımızı icat etmek yerine onu kullanıyoruz; orval de bu şemadan hata tipini üretebilecek.
- **Güvenlik:** Beklenmeyen hataların (veritabanı mesajı, stack trace) client'a sızmaması gerekiyor.
- Karar kaydı: [018](../decisions.md).

## Nasıl çalışıyor

1. **Şema ([problem-details.ts](../../apps/api/src/common/problem-details.ts)):**
   - Standart alanlar: `type`, `title`, `status`, `detail`, `instance`.
   - Eklentiler:
     - `code`: sabit bir enum. Client `title`'a değil buna göre dallanır.
     - `requestId`.
     - `errors[]`: validasyon hatalarında alan bazında `{ path, message }`.
   - Şema Zod ile yazıldı; ileride OpenAPI'ye de buradan girecek.
2. **`ProblemException`:**
   - Kodun herhangi bir yerinden `status`, `code` ve opsiyonel `detail`, `errors`, `headers` ile fırlatılıyor.
   - `title` verilmezse koddan türetiliyor.
3. **Filter ([problem-details.filter.ts](../../apps/api/src/common/problem-details.filter.ts)):** `@Catch()` ile her hatayı yakalıyor.
   - `ProblemException` olduğu gibi yazılıyor.
   - Nest'in `HttpException`'ları status'e göre koda eşleniyor. Bunlar bilinmeyen route, bozuk JSON gövdesi ve boyut sınırı gibi hatalar.
   - Diğer her şey 500 `internal_error` oluyor; detay yalnızca loga yazılıyor.
   - Filter'a ham bir `ZodError` ulaşırsa bu da 500: request validasyonu kendi hatalarını zaten 400'e çeviriyor, demek ki bu iç bir parse hatası.
4. **Request id ([request-id.middleware.ts](../../apps/api/src/common/request-id.middleware.ts)):**
   - Gelen `X-Request-Id` başlığı güvenli bir biçimdeyse (harf, rakam, `-`, `_`, en fazla 64 karakter) kullanılıyor, değilse yeni bir UUID üretiliyor.
   - Yanıt başlığına da yazılıyor. Böylece kullanıcının gönderdiği hata ekran görüntüsünden ilgili log satırı bulunabiliyor.
5. **Kayıt ([common.module.ts](../../apps/api/src/common/common.module.ts)):** `APP_FILTER` ve tüm route'lar için middleware.

## Sınır durumları ve kısıtlar

- `type` göreli bir URI (`/problems/not-found`). Şimdilik bu adreste bir doküman yok; RFC buna izin veriyor ama ideali açıklayan bir sayfa olması.
- Yanıt yazılmaya başlandıktan sonra (ileride SSE streaming) gelen hata problem+json'a çevrilemiyor; bağlantı yalnızca kapatılıyor.
- Prisma hatalarının (unique ihlali → 409, kayıt yok → 404) eşlenmesi henüz yok, links endpoint'leriyle birlikte gelecek.
- Başka kullanıcının kaynağına erişimde 403 değil 404 dönme kuralı servis katmanında uygulanacak; filter bunu kendisi bilmiyor.

## Mülakat soruları

1. RFC 9457 nedir, hangi alanları tanımlar?
   <details><summary>Cevap</summary>HTTP API hataları için standart JSON biçimi (RFC 7807'nin güncellenmiş hâli). `type` (hata türünü tanımlayan URI), `title` (kısa açıklama), `status`, `detail` (bu olaya özgü açıklama), `instance` (olayın gerçekleştiği kaynak). Ek alanlar (extension members) serbestçe eklenebilir.</details>
2. Client neden `title` yerine `code`'a göre dallanmalı?
   <details><summary>Cevap</summary>`title` insan için yazılmış bir metin; çevrilebilir veya değişebilir. `code` sabit bir sözleşme. Metni değiştirmek client'ı bozmamalı.</details>
3. 5xx hatalarında neden detay göstermiyoruz?
   <details><summary>Cevap</summary>Beklenmeyen hata mesajları içeriden bilgi sızdırır: SQL, tablo adları, dosya yolları, bazen sırlar. Saldırgan bunları keşif için kullanır. Detay loga yazılır, client'a sadece `requestId` gider.</details>
4. Başka kullanıcının kaydına erişimde neden 403 değil 404?
   <details><summary>Cevap</summary>403 "bu kayıt var ama senin değil" demektir; kaydın varlığını sızdırır (enumeration). 404, kaydın olmadığı durumla aynı yanıtı verir.</details>
5. Request id neden dışarıdan kabul ediliyor, neden doğrulanıyor?
   <details><summary>Cevap</summary>Bir proxy veya client kendi id'sini gönderirse istek uçtan uca aynı id ile izlenebilir. Doğrulanmazsa saldırgan log satırlarına yeni satır veya sahte içerik ekleyebilir (log injection); uzun değerler de logu şişirir.</details>
6. Validasyon hatası için 400 mü 422 mi?
   <details><summary>Cevap</summary>İkisi de savunulabilir: 422 "biçim doğru ama içerik geçersiz" der, 400 genel "hatalı istek"tir. Burada tek kod (400 + `validation_failed`) seçildi; ayrım `code` ile yapılıyor, client'ın iki status'ü ayrı ele alması gerekmiyor.</details>

## Kendini test et

- Controller'da fırlatılan bir `ProblemException`'ın client'a giden JSON'a dönüşmesini adım adım anlat.
- Beklenmeyen bir hatada client'ın ve logun neyi gördüğünü karşılaştır.
- Bozuk JSON gövdesiyle gelen bir isteğin neden 400 aldığını, kimin bu hatayı ürettiğini açıkla.
