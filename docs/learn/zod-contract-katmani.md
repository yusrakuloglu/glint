# Zod contract katmanı

## Ne yaptık

- Her endpoint tek bir **contract** nesnesiyle tanımlanıyor: method, path, auth, params/query/body şemaları ve response şeması.
- Route kaydı, validasyon, response filtreleme ve handler tipleri bu nesneden türetiliyor. OpenAPI dokümanı da aynı yerden üretilecek.
- Tek bir şema, hem çalışma anı kontrolü hem tip hem doküman demek. İkisi birbirinden kopamıyor.

## Neden

- Validasyon şeması ile doküman ayrı yazılırsa zamanla birbirinden ayrışıyor (drift); client yanlış tiple çalışıyor.
- **Değerlendirilen alternatifler:**
  - `nestjs-zod`: en yaygın çözüm ama peer aralığı Nest ≤11. Nest 12'de resmi desteği yok.
  - `@nestjs/swagger` + `@ApiProperty`: şema iki kez yazılıyor.
  - ts-rest / oRPC: kendi client'larını getiriyor, orval'ın yerini alıyor.
- Karar kaydı: [020](../decisions.md).

## Nasıl çalışıyor

1. **Tanım ([endpoint-contract.ts](../../apps/api/src/common/contract/endpoint-contract.ts)):**
   - `defineEndpoint` contract'ı `const` generic ile alıyor; literal tipler korunuyor.
   - `EndpointInput<typeof c>` şemaların **output** tipini, `EndpointResult<typeof c>` response şemasının **input** tipini veriyor.
   - Örneğin `createdAt` handler'dan `Date` olarak dönüyor, JSON'a ISO string olarak çıkıyor.
2. **Decorator ([endpoint.decorator.ts](../../apps/api/src/common/contract/endpoint.decorator.ts)):**
   - `@Endpoint(contract)` şunları tek seferde uyguluyor: `@Get/@Post(path)`, `@HttpCode(status)`, contract metadata'sı, `ContractInterceptor` ve gerekiyorsa `@Public()`.
   - `@Input()` doğrulanmış `{ params, query, body }` nesnesini handler'a veriyor.
3. **Interceptor ([contract.interceptor.ts](../../apps/api/src/common/contract/contract.interceptor.ts)):**
   - Guard'lardan sonra çalışıyor: token yoksa 401 dönüyor, kullanıcı validasyon hatası görmüyor.
   - Üç parçayı da `safeParse` ediyor ve tüm hataları `errors[]` içinde tek bir 400'de topluyor (`body.url`, `query.limit` gibi yollarla).
   - Handler'ın dönüşünü response şemasından geçiriyor: şemada olmayan alanlar (`userId`, `deletedAt`) atılıyor, şemaya uymayan yanıt 500 oluyor.
4. **Şema detayları ([links.contracts.ts](../../apps/api/src/links/links.contracts.ts)):**
   - Body'ler `strictObject`: bilinmeyen alan 400 alıyor. Bu, mass assignment koruması.
   - URL alanı `transform` ile hem orijinal hem normalize hâli üretiyor. Normalizasyon hatası da `body.url` yolunda bir validasyon hatası oluyor.
   - Query'deki sayılar `z.coerce` ile çevriliyor, çünkü query string'de her şey metin.

## Sınır durumları ve kısıtlar

- Express 5'te `req.query` yazılamıyor. Bu yüzden doğrulanmış değerler `request.input`'a yazılıyor; Nest'in `@Body()`/`@Query()` decorator'ları ham veriyi verir, kullanılmamalı.
- Nest `@HttpCode` status'ünü handler'dan sonra statik olarak yeniden yazıyor. Bir endpoint tek bir başarı status'ü dönebiliyor; `POST /links` tekrar kaydetmede de 201.
- Response'u parse etmek küçük bir CPU maliyeti getiriyor. Büyük listelerde ölçülmeli.
- `@Endpoint` olmayan bir route'ta `@Input()` kullanılırsa çalışma anında hata alınıyor; derleme zamanında yakalanmıyor.

## Mülakat soruları

1. "Single source of truth" bir API'de neden önemli?
   <details><summary>Cevap</summary>Validasyon, tip ve doküman ayrı yerlerde yazılırsa biri güncellenip diğeri unutulur. Client dokümana güvenip sunucunun reddettiği isteği gönderir. Tek kaynaktan türetmek bu sapmayı imkânsız kılar.</details>
2. Mass assignment nedir, burada nasıl engelleniyor?
   <details><summary>Cevap</summary>Client'ın gönderdiği nesnenin doğrudan veritabanına yazılması. Saldırgan `userId` veya `role` gibi alanları ekleyerek yetkisini değiştirebilir. Burada body `strictObject`: bilinmeyen alan 400 alır. `userId` her zaman token'dan gelir.</details>
3. Response'u neden şemadan geçiriyoruz?
   <details><summary>Cevap</summary>Prisma kaydı client'a gönderilmemesi gereken alanlar içerir (`userId`, `deletedAt`). Şema bir allowlist gibi çalışır: yalnızca dokümante edilen alanlar çıkar. Ayrıca doküman ile gerçek yanıtın eşleştiği garanti olur.</details>
4. Validasyon neden guard'lardan sonra çalışıyor?
   <details><summary>Cevap</summary>Kimliği doğrulanmamış bir istemciye API'nin hangi alanları beklediğini anlatmamak için. Ayrıca kimlik doğrulama daha temel bir hata; önce o raporlanmalı.</details>
5. Zod'da input ve output tipi neden farklı olabilir?
   <details><summary>Cevap</summary>`transform`, `default` ve `coerce` değeri değiştirir. Query'de `limit` input'ta string, output'ta number. Response'ta `createdAt` input'ta Date, output'ta string. Handler output'u alır, response şemasına input'u verir.</details>
6. Tüm validasyon hatalarını neden tek yanıtta topluyoruz?
   <details><summary>Cevap</summary>Client form alanlarının hepsini tek seferde işaretleyebilir. Hata hata düzeltip tekrar göndermek hem kullanıcıyı hem ağı yorar.</details>

## Kendini test et

- Bir contract'tan route'a, validasyona, handler tipine ve response'a giden yolu anlat.
- `POST /links` body'sinde `url` alanının hangi adımlardan geçtiğini anlat.
- Response şemasına uymayan bir değer dönülürse ne olduğunu ve neden 500 olduğunu açıkla.
