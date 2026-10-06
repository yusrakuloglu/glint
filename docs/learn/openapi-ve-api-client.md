# OpenAPI ve tipli API client

## Ne yaptık

- API'nin OpenAPI 3.1 dokümanı, endpoint contract'larından otomatik üretiliyor ve `apps/api/openapi.json` olarak commit'leniyor.
- `packages/api-client`, bu dokümandan orval ile TanStack Query hook'ları ve TypeScript tipleri üretiyor.
- Web uygulaması API'yi elle `fetch` yazmadan, üretilen hook'larla çağırıyor. Zod şemasından React bileşenine kadar tek bir tip zinciri var.

## Neden

- **Uçtan uca tip güvenliği:** API'de bir alanın adı değişirse web'in typecheck'i kırılıyor; hata çalışma anında değil derleme anında yakalanıyor.
- **Commit'lenen doküman:** Sözleşme değişikliği PR diff'inde görünüyor; client üretmek için API'yi çalıştırmak gerekmiyor.
- **orval:** Hem client fonksiyonlarını hem TanStack Query hook'larını (infinite query dahil) üretiyor. Proje kuralı olarak da belirlendi.
- **Değerlendirilen alternatifler:**
  - openapi-typescript + openapi-fetch: yalnızca tip ve fetch üretiyor, hook'ları elle yazmak gerekiyor.
  - ts-rest: OpenAPI'ye gerek kalmadan contract paylaşıyor ama API tarafını değiştirmeyi gerektiriyor.
- Karar kayıtları: [023](../decisions.md), [024](../decisions.md).

## Nasıl çalışıyor

1. **Doküman üretimi ([openapi-document.ts](../../apps/api/src/openapi/openapi-document.ts)):**
   - `createOpenApiDocument`, [endpoints.ts](../../apps/api/src/openapi/endpoints.ts)'teki her contract'ı bir OpenAPI operasyonuna çeviriyor:
     - path dönüşümü: `:id` → `{id}`,
     - params, query, body ve başarılı yanıt,
     - auth gerektirenler için `bearerAuth` security tanımı.
   - Tüm hatalar `default: application/problem+json` olarak tanımlanıyor; client hata tipini de buradan alıyor.
   - `.meta({ id: 'Link' })` gibi işaretler component adlarını belirliyor; orval bunları tip adı olarak kullanıyor.
   - Tarihler `z.date().transform().pipe(z.iso.datetime())` ile yazıldı: handler `Date` döndürüyor, dokümanda `string (date-time)` görünüyor.
2. **Komut:** `pnpm --filter @glint/api openapi:generate` API'yi build edip [generate.ts](../../apps/api/src/openapi/generate.ts)'i çalıştırıyor ve `openapi.json`'u yazıyor.
3. **Bayatlık kontrolü ([openapi.spec.ts](../../apps/api/src/openapi/openapi.spec.ts)):**
   - Commit'lenmiş dosya güncel değilse unit test kırılıyor ve hangi komutun çalıştırılacağını söylüyor.
   - Başka bir test, Nest'e kayıtlı her `@Endpoint` route'unun registry'de olduğunu `DiscoveryService` ile doğruluyor.
4. **Sunum ([openapi.controller.ts](../../apps/api/src/openapi/openapi.controller.ts)):** Çalışan API `/openapi.json`'u ve Scalar arayüzünü `/docs`'ta sunuyor.
5. **Client üretimi ([orval.config.ts](../../packages/api-client/orval.config.ts)):**
   - `tags-split` modu: etiket başına bir dosya (`links`, `health`) ve ayrı bir `models` klasörü.
   - `listLinks` için ayrıca `useListLinksInfinite` üretiliyor; `cursor` parametresi sayfa parametresi olarak işaretli.
   - Çıktı git'e girmiyor. turbo'nun `codegen` görevi lint, typecheck, test, build ve dev'den önce otomatik çalışıyor.
6. **Mutator ([fetcher.ts](../../packages/api-client/src/fetcher.ts)):** Üretilen her istek `apiFetch`'ten geçiyor.
   - `configureApiClient` ile verilen base URL ve access token'ı ekliyor.
   - 2xx dışı yanıtları, içinde tipli `ProblemDetails` bulunan `ApiProblemError`'a çeviriyor.
   - Ağ hatalarını `status: 0`, `code: 'service_unavailable'` ile aynı tipe çeviriyor. İptal edilen istekler (AbortSignal) değişmeden geçiyor.
7. **Web ([providers.tsx](../../apps/web/src/app/providers.tsx), [api-status.tsx](../../apps/web/src/app/api-status.tsx)):**
   - `QueryClientProvider` uygulamayı sarıyor.
   - Ana sayfa `useGetHealth` ile API durumunu gösteriyor.
   - API, CORS ile yalnızca `WEB_ORIGIN`'e izin veriyor ([configure-app.ts](../../apps/api/src/configure-app.ts)).

## Sınır durumları ve kısıtlar

- `pnpm --filter @glint/api-client typecheck` doğrudan çalıştırılırsa üretilmiş kod yoksa hata verir; komutlar turbo üzerinden (`pnpm typecheck`) çalıştırılmalı.
- Contract değişince `openapi:generate` elle çalıştırılmalı. Unutulursa test kırılır, sessizce eskimez.
- Infinite query'de `getNextPageParam` (`lastPage.nextCursor`) her kullanımda verilmeli; Faz 4'te ortak bir sarmalayıcı yazılabilir.
- Access token henüz `null`; Supabase oturumu Faz 4'te bağlanacak. O zamana kadar web yalnızca public endpoint'leri çağırabiliyor.
- Scalar arayüzü script'ini CDN'den yüklüyor; sıkı bir CSP eklenirse izin verilmesi gerekecek.

## Mülakat soruları

1. Code-first ile design-first (spec-first) OpenAPI yaklaşımlarının farkı nedir? Burada hangisi var?
   <details><summary>Cevap</summary>Design-first'te önce OpenAPI dosyası yazılır, kod ona uyar. Code-first'te doküman koddan üretilir. Burada code-first var ama kaynak Zod contract'ları; validasyon ve doküman aynı yerden geldiği için kayma olmuyor.</details>
2. Üretilen dokümanı neden commit'liyoruz ama üretilen client'ı commit'lemiyoruz?
   <details><summary>Cevap</summary>Doküman bir sözleşme: değişikliği review'da görülmeli ve client üretimi API'yi çalıştırmadan yapılabilmeli. Client ise bu sözleşmeden deterministik olarak türüyor; commit'lemek diff'i şişirir ve elle düzenlenme riskini getirir.</details>
3. Mutator ne işe yarar?
   <details><summary>Cevap</summary>orval'ın ürettiği her isteğin geçtiği tek fonksiyon. Base URL, auth header, hata dönüşümü gibi kesişen konular tek yerde toplanıyor; üretilen kod bunlardan habersiz kalıyor.</details>
4. Hatayı neden `{ data, error }` döndürmek yerine fırlatıyoruz?
   <details><summary>Cevap</summary>TanStack Query, fırlatılan hatayı `error` state'ine koyar, retry ve error boundary mekanizmalarını çalıştırır. Hata tipi tek (`ApiProblemError`) olduğu için bileşen `error.problem.code`'a güvenle bakabilir.</details>
5. Ağ hatasını neden de `ApiProblemError`'a çevirdik?
   <details><summary>Cevap</summary>Hook'ların hata tipi `ApiProblemError` olarak bildiriliyor. `fetch` ağ hatasında `TypeError` fırlatınca bu tip yalan oluyordu ve `error.problem.code` okuyan bileşen çöktü (tarayıcıda gözlendi). Tek tip, her hata yolunu aynı şekilde ele almayı sağlıyor. İptaller ise hata değil, o yüzden ayrı tutuluyor.</details>
6. CORS ne korur, ne korumaz?
   <details><summary>Cevap</summary>Tarayıcının başka bir origin'deki sayfanın API'ye kimlik bilgisiyle istek atıp yanıtı okumasını engeller. Sunucuyu korumaz: curl veya başka bir sunucu CORS'a takılmaz. Asıl yetki kontrolü token doğrulamasıdır.</details>

## Kendini test et

- `links.contracts.ts`'te bir alan eklendiğinde web bileşenine kadar hangi adımların çalıştığını anlat.
- `openapi.json`'u güncellemeyi unutursan neyin, neden kırıldığını açıkla.
- API kapalıyken web sayfasında ne göründüğünü ve bunun için mutator'da ne yapıldığını anlat.
