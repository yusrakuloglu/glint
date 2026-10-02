# NestJS temeli

## Ne yaptık

İki NestJS uygulaması var:

- **api:** HTTP sunucusu. Şimdilik tek endpoint'i `GET /health`.
- **worker:** HTTP sunucusu olmayan bir uygulama context'i. Faz 3'te pg-boss job'larını çalıştıracak.

Testler Vitest ile yazılıyor. Nest'in decorator metadata'sı için derleme SWC ile yapılıyor.

## Neden

- **NestJS:** Modül yapısı, DI ve OpenAPI desteği hazır geliyor; büyüyen bir API için düzen sağlıyor. Alternatif olarak Fastify veya Hono daha hafif, ama mimariyi elle kurmak gerekirdi.
- **api ve worker ayrımı:** Uzun süren AI ve embedding işleri HTTP isteklerini yavaşlatmasın; ikisi bağımsız ölçeklensin. Kuyruk Postgres üzerinde ([002](../decisions.md)).
- **Vitest + SWC ([009](../decisions.md)):** Repo genelinde tek test runner olsun. Nest'in varsayılanı Jest + ts-jest; o seçilseydi frontend için ikinci bir runner gerekirdi.
- **Node 24 ([010](../decisions.md)):** Node 23.7'de Nest CLI `ERR_REQUIRE_CYCLE_MODULE` ile çöküyordu.

## Nasıl çalışıyor

1. **Modül ağacı:**
   - [AppModule](../../apps/api/src/app.module.ts), [HealthModule](../../apps/api/src/health/health.module.ts)'ü import ediyor.
   - HealthModule, [HealthController](../../apps/api/src/health/health.controller.ts)'ı kaydediyor.
   - `@Controller('health')` + `@Get()` birleşince `GET /health` route'u oluşuyor.
2. **Başlatma ([api main.ts](../../apps/api/src/main.ts)):**
   - `NestFactory.create` uygulamayı kuruyor.
   - `enableShutdownHooks` sayesinde SIGTERM gelince modüller düzgün kapanıyor.
   - Port `API_PORT` değişkeninden geliyor, varsayılanı 3001.
3. **Worker ([worker main.ts](../../apps/worker/src/main.ts)):** `createApplicationContext` aynı DI container'ını HTTP katmanı olmadan kuruyor.
4. **Test ([health.controller.spec.ts](../../apps/api/src/health/health.controller.spec.ts)):**
   - `Test.createTestingModule({ imports: [AppModule] })` gerçek modül ağacını kuruyor.
   - `supertest` HTTP isteği atıyor. Hem 200 + gövde, hem de bilinmeyen route için 404 kontrol ediliyor.
   - Bu yaklaşım, controller'ı izole test etmek yerine routing'i de kapsıyor.
5. **SWC ([vitest.config.ts](../../apps/api/vitest.config.ts)):**
   - Vitest varsayılan olarak esbuild kullanır ve esbuild `emitDecoratorMetadata` üretemez.
   - Nest DI, constructor parametre tiplerini bu metadata'dan okur; metadata yoksa enjeksiyon `undefined` gelir.
   - `unplugin-swc` derlemeyi SWC'ye devrediyor.
6. **Build:** `nest build`, `tsc` ile [tsconfig.build.json](../../apps/api/tsconfig.build.json)'u kullanıyor. `*.spec.ts` dosyaları dışarıda kalıyor.

## Sınır durumları ve kısıtlar

- Health endpoint'i yalnızca "process ayakta" bilgisini veriyor; veritabanı bağlantısını kontrol etmiyor (readiness değil, liveness).
- Worker'da henüz test yok; mantık Faz 3'te geliyor.
- SWC ile tsc çıktısı birebir aynı değil. Testler SWC ile, build tsc ile derleniyor; nadir de olsa farklılık çıkabilir.
- Hata formatı ve validasyon katmanı henüz yok (Faz 2).

## Mülakat soruları

1. NestJS'te modül, controller ve provider ne işe yarar?
   <details><summary>Cevap</summary>Modül, ilgili parçaları gruplayan ve DI kapsamını belirleyen birimdir. Controller HTTP isteklerini karşılar. Provider (genelde service) iş mantığını taşır ve DI ile enjekte edilir.</details>
2. Dependency Injection nedir, ne kazandırır?
   <details><summary>Cevap</summary>Bir sınıf bağımlılıklarını kendisi oluşturmaz, dışarıdan alır; container nesneleri oluşturup bağlar. Bağımlılıklar testte mock'la değiştirilebilir ve parçalar gevşek bağlı olur.</details>
3. Nest DI constructor parametrelerinin tipini nasıl bilir?
   <details><summary>Cevap</summary>`emitDecoratorMetadata` açıkken TS, decorator'lı sınıflar için `design:paramtypes` metadata'sı üretir. `reflect-metadata` bunu okunabilir kılar. Nest bu tiplere bakıp hangi provider'ı enjekte edeceğine karar verir.</details>
4. Testlerde neden esbuild yerine SWC kullanıyoruz?
   <details><summary>Cevap</summary>esbuild decorator metadata üretmiyor. Metadata olmadan Nest DI çalışmaz, servisler `undefined` gelir. SWC bu metadata'yı üretebiliyor.</details>
5. `createApplicationContext` ile `create` farkı nedir?
   <details><summary>Cevap</summary>`create` HTTP adapter'ıyla birlikte tam bir web uygulaması kurar. `createApplicationContext` yalnızca DI container'ını ve modül yaşam döngüsünü kurar; worker veya CLI gibi HTTP gerektirmeyen işler için uygundur.</details>
6. Liveness ile readiness probe farkı nedir?
   <details><summary>Cevap</summary>Liveness: process yaşıyor mu? Başarısızsa yeniden başlatılır. Readiness: trafik almaya hazır mı (DB bağlı mı vb.)? Başarısızsa trafik yönlendirilmez ama process yeniden başlatılmaz.</details>
7. `enableShutdownHooks` neden önemli?
   <details><summary>Cevap</summary>Sinyal geldiğinde `onModuleDestroy` / `beforeApplicationShutdown` hook'ları çalışır: DB bağlantıları kapanır, devam eden job'lar bitirilir. Deploy sırasında veri kaybı ve yarım işler önlenir.</details>

## Kendini test et

- `GET /health` isteğinin uygulamaya girişinden yanıta kadar izlediği yolu anlat.
- SWC olmadan testlerde ne bozulurdu, neden?
- api ile worker'ın aynı kodu paylaşıp ayrı process olmasının faydasını açıkla.
