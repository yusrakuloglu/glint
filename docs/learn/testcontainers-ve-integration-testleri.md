# Testcontainers ve integration testleri

## Ne yaptık

- API, gerçek bir Postgres'e (pgvector'lü) karşı uçtan uca test ediliyor: HTTP isteği → guard → validasyon → servis → veritabanı.
- Postgres, test sırasında Testcontainers ile bir Docker container'ında başlatılıp sonunda kapatılıyor.
- Testlerin ağırlığı yetkilendirmede: bir kullanıcının başka bir kullanıcının verisine hiçbir yoldan erişemediği kanıtlanıyor.

## Neden

- **Mock yetmiyor:** Yetki hatalarının çoğu sorgu katmanında oluyor (unutulan bir `where userId`). Prisma'yı mock'layan bir test bu hatayı göremez.
- **Gerçek kısıtlar:** Composite FK, `CHECK`, unique ihlalleri ve `ON CONFLICT` davranışı ancak gerçek Postgres'te test edilebiliyor.
- **Değerlendirilen alternatifler:**
  - GitHub Actions service container: yalnızca CI'da çalışıyor, lokalde ayrı kurulum istiyor.
  - Her testten sonra truncate: paralel çalışan dosyalar birbirinin verisini siliyor.
  - pg-mem gibi sahte veritabanları: pgvector ve kısıt davranışları gerçekle aynı değil.
- Karar kaydı: [021](../decisions.md).

## Nasıl çalışıyor

1. **İki Vitest projesi ([vitest.config.ts](../../apps/api/vitest.config.ts)):**
   - `unit`: `*.spec.ts` dosyaları, Docker gerektirmiyor (`pnpm test`).
   - `integration`: `*.int-spec.ts` dosyaları (`pnpm test:int`).
2. **Global setup ([global-setup.ts](../../apps/api/src/testing/integration/global-setup.ts)):**
   - Çalıştırma başına bir kez `pgvector/pgvector:pg17` container'ı başlatıyor. Compose ile aynı imaj kullanıldığı için lokal ortamla birebir aynı.
   - `prisma migrate deploy` ile `glint_template` veritabanını migrate ediyor.
   - Yönetim bağlantı adresini Vitest'in `provide/inject` mekanizmasıyla test dosyalarına iletiyor.
3. **Dosya başına veritabanı ([test-database.ts](../../apps/api/src/testing/integration/test-database.ts)):**
   - `CREATE DATABASE test_x TEMPLATE glint_template` çalıştırılıyor. Postgres template'i dosya seviyesinde kopyaladığı için bu işlem migration çalıştırmaktan çok daha hızlı.
   - Dosyalar paralel çalışıyor ve birbirinin verisini görmüyor; temizlik gerekmiyor.
4. **Test uygulaması ([test-app.ts](../../apps/api/src/testing/integration/test-app.ts)):**
   - Gerçek `AppModule`'ü kuruyor; yalnızca iki şey değiştiriliyor:
     - `ENV`: veritabanı adresi container'a çevriliyor.
     - `JWT_KEY_RESOLVER`: yerel bir ES256 key kullanılıyor.
   - `createUser()` rastgele bir uuid ve imzalı token üretiyor.
5. **Senaryolar:**
   - [links.int-spec.ts](../../apps/api/src/links/links.int-spec.ts): B, A'nın linkini okuyamıyor, güncelleyemiyor, silemiyor (her biri 404 ve A'nın verisi değişmiyor). B'nin listesinde ve A'nın cursor'uyla A'nın linki görünmüyor. Body'deki `userId` reddediliyor. Aynı milisaniyedeki linkler sayfalar arasında atlanmıyor. Eşzamanlı kaydetmeler tek Content oluşturuyor.
   - [tenant-isolation.int-spec.ts](../../apps/api/src/prisma/tenant-isolation.int-spec.ts): Tag, Collection ve Highlight'ın başka kullanıcının linkine bağlanamadığı veritabanı seviyesinde test ediliyor.
6. **Testler gerçekten bir şey ölçüyor mu?**
   - Kritik testler, kod kasıtlı bozularak denendi. Örneğin sorgudan `userId` filtresi kaldırılınca yalnızca ilgili yetki testleri kırıldı.
7. **CI ([ci.yml](../../.github/workflows/ci.yml)):**
   - Ayrı bir `integration` job'ı var. Mevcut job ile paralel koşuyor ve Playwright kurulumu gerektirmiyor.
   - GitHub runner'larında Docker hazır geliyor.

## Sınır durumları ve kısıtlar

- Lokalde Docker çalışıyor olmalı. Colima gibi farklı bir runtime'da `DOCKER_HOST` ayarı gerekebilir.
- İlk çalıştırmada imaj indiriliyor (~yüz MB); CI'da her seferinde inme süresi ekleniyor.
- Template'ten kopyalama sırasında template'e açık bağlantı olmamalı. Migration bittikten sonra kopyalandığı için sorun yok.
- Test veritabanları silinmiyor; container kapanınca hepsi gidiyor.
- Gerçek Supabase'e karşı test yok: token biçimi yerelde taklit ediliyor. Supabase claim'leri değiştirirse testler bunu yakalamaz.

## Mülakat soruları

1. Unit ve integration testi arasındaki fark nedir, ikisi de neden gerekli?
   <details><summary>Cevap</summary>Unit test bir birimi izole ve hızlı test eder (URL normalizasyonu, cursor encode). Integration test parçaların birlikte, gerçek bağımlılıklarla çalıştığını doğrular (sorgu, kısıt, auth zinciri). Unit testler hızlı geri bildirim, integration testler gerçek hataları yakalar.</details>
2. Testcontainers ne sağlar?
   <details><summary>Cevap</summary>Testten programatik olarak gerçek servisleri (Postgres, Redis...) container'da başlatır, rastgele port verir, hazır olmasını bekler ve test bitince kapatır. Lokal ve CI aynı şekilde çalışır.</details>
3. Test izolasyonu için hangi yöntemler var?
   <details><summary>Cevap</summary>Her testi transaction'da çalıştırıp geri almak (uygulama kendi transaction'ını açınca karmaşıklaşır), testler arası truncate (paralelliği bozar), test başına şema veya veritabanı. Burada dosya başına template'ten kopyalanan veritabanı seçildi: hızlı ve paralel.</details>
4. Yetkilendirme testlerinde neyi kanıtlamaya çalışırsın?
   <details><summary>Cevap</summary>Her işlem (oku, listele, güncelle, sil, ilişkilendir) için başka bir kullanıcının kaynağına erişimin reddedildiğini ve hedef verinin değişmediğini. Ayrıca yanıtın varlığı sızdırmadığını (404, olmayan kayıtla aynı) ve dolaylı yolların (cursor, body'deki userId) da kapalı olduğunu.</details>
5. "Mutation testing" mantığıyla bir testin değerli olduğunu nasıl anlarsın?
   <details><summary>Cevap</summary>Kodda kasıtlı bir hata yapılır (bir koşul silinir) ve testin kırıldığı görülür. Kırılmıyorsa test o davranışı korumuyordur. Stryker gibi araçlar bunu otomatikleştirir.</details>
6. Integration testlerinin CI'a maliyeti nedir, nasıl yönetilir?
   <details><summary>Cevap</summary>İmaj indirme ve container açılışı yaklaşık bir dakika ekler. Ayrı bir job'da paralel koşturmak toplam süreyi uzatmaz, hatayı da ayrı sinyal olarak gösterir. Template veritabanı migration'ı tek seferle sınırlar.</details>

## Kendini test et

- `pnpm test:int` çalıştığında container'ın açılmasından ilk HTTP isteğine kadar olanları anlat.
- Template veritabanının neden hızlı olduğunu ve paralel testleri nasıl yalıttığını açıkla.
- Bir yetki açığını yakalayan testi seç ve kodun hangi satırı silinirse kırılacağını göster.
