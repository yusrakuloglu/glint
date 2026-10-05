# Veri modeli ve kiracı izolasyonu

## Ne yaptık

- Altı ana tablo kuruldu: Content, SavedLink, Chunk, Tag, Collection, Highlight. Bunlara iki ara tablo eşlik ediyor: SavedLinkTag ve CollectionItem.
- Content URL bazında herkesle paylaşılıyor. Geri kalan her şey kullanıcıya ait.
- Kullanıcıya ait kayıtlar, ebeveynlerine `(id, user_id)` composite FK ile bağlanıyor. Böylece veritabanı iki kullanıcının verisini birbirine bağlamayı reddediyor.

## Neden

- **Paylaşılan Content ([005](../decisions.md)):** Aynı makale için özet ve embedding bir kez üretiliyor. Kullanıcının notu, etiketi ve okunma durumu ise SavedLink'te tutuluyor.
- **Composite FK ([016](../decisions.md)):** Çok kiracılı (multi-tenant) bir sistemde en tehlikeli hata, A kullanıcısının bir kaydının B'nin kaydına bağlanması. Uygulama katmanında yapılan kontroller bir gün unutulabilir; veritabanı kısıtı unutulmaz.
- **RLS kullanılmadı:** Postgres Row Level Security de iyi bir savunma katmanı olurdu. Ama API tek bir DB rolüyle bağlanıyor. RLS için her transaction'da `SET LOCAL app.user_id` gerekirdi ve bu Prisma ile zahmetli.
- **Auth'a FK yok:** Kullanıcılar Supabase'de, uygulama verisi ayrı bir Postgres'te. Farklı veritabanları arasında FK kurulamıyor.
- **Soft delete:** Silinen link 30 gün geri alınabilir kalıyor. Aynı URL tekrar kaydedilirse eski satır geri geliyor ve highlight'ları korunuyor.

## Nasıl çalışıyor

1. **Şema ([schema.prisma](../../apps/api/prisma/schema.prisma)):**
   - Tablo ve kolon adları `@@map`/`@map` ile snake_case. Faz 5'teki raw SQL sorguları bu sayede okunabilir kalacak.
   - ID'ler `@default(uuid(7))`. UUIDv7 zamana göre sıralı olduğu için B-tree index'e hep sondan ekleniyor; rastgele v4'teki sayfa bölünmeleri olmuyor.
   - Zaman damgaları `Timestamptz(3)`. Hassasiyet milisaniye, yani JS `Date` ile aynı. Cursor'a yazılan değer veritabanındakiyle birebir eşleşiyor.
2. **Composite FK:**
   - SavedLink, Tag ve Collection'da `@@unique([id, userId])` var. `id` zaten tek başına benzersiz, ama FK'nın hedef alabilmesi için bu ikilinin de unique olması gerekiyor.
   - SavedLinkTag'de tek bir `user_id` kolonu, iki FK'nın da parçası:
     - `(saved_link_id, user_id) → saved_links(id, user_id)`
     - `(tag_id, user_id) → tags(id, user_id)`
   - Link başka kullanıcınınsa iki FK'dan biri mutlaka tutmaz ve insert reddedilir. CollectionItem ve Highlight da aynı kalıbı kullanıyor.
3. **Benzersizlik:**
   - `contents.url`: normalize URL başına tek Content ([url-normalizasyonu](url-normalizasyonu.md)).
   - `saved_links(user_id, content_id)`: kullanıcı başına bir kayıt. Soft delete edilmiş satır da bu kısıta dahil, bu yüzden tekrar kaydetme "geri getirme" demek.
   - `tags(user_id, slug)` ve `collections(user_id, name)`.
4. **Migration ([add_data_model](../../apps/api/prisma/migrations/20261005191153_add_data_model/migration.sql)):**
   - Prisma `--create-only` ile üretildi.
   - URL uzunluğu için `CHECK` kısıtı elle eklendi, çünkü Prisma şemasında CHECK tanımlanamıyor.
5. **Silme davranışları:**
   - Content silinirse chunk'lar da silinir (cascade).
   - Bir SavedLink'e bağlı Content silinemez (restrict).
   - SavedLink kalıcı silinirse etiket bağları, koleksiyon kayıtları ve highlight'lar da silinir.

## Sınır durumları ve kısıtlar

- `uuid(7)` Prisma client'ında üretiliyor; SQL'de `DEFAULT` yok. Raw SQL ile insert yapılırken id'yi kod vermeli.
- Supabase'de silinen kullanıcının verisi kendiliğinden silinmiyor. Temizliği ileride bir job yapacak.
- Soft delete filtresi (`deleted_at IS NULL`) her sorguda unutulmamalı. Bu yüzden link sorguları tek bir repository'den geçecek.
- Soft delete edilmiş bir link'in highlight'ları DB'de duruyor. Onları gizlemek API'nin işi.
- `Unsupported("vector(384)")` kolonu Prisma'nın sorgu API'sinde görünmüyor; okuma ve yazma raw SQL ile yapılacak.

## Mülakat soruları

1. Multi-tenant bir uygulamada tenant izolasyonu hangi katmanlarda sağlanabilir?
   <details><summary>Cevap</summary>Uygulama katmanı (her sorguda `where userId`), veritabanı kısıtları (composite FK), Postgres RLS, ayrı şema veya ayrı veritabanı. İlk ikisi ucuz ve birlikte kullanılıyor. RLS en güçlüsü ama bağlantı başına kullanıcı bağlamı gerektirir. Ayrı DB en güçlü izolasyon ama en pahalı.</details>
2. Composite FK, iki kullanıcının verisinin birbirine bağlanmasını nasıl engelliyor?
   <details><summary>Cevap</summary>Ara tablodaki tek `user_id` kolonu iki FK'nın da parçası. Link `(id, A)` çiftiyle, tag `(id, B)` çiftiyle var. Satırdaki user_id A ise tag FK'sı, B ise link FK'sı tutmaz. Tutarlı tek değer yoksa insert reddedilir.</details>
3. Neden `id` zaten unique iken `(id, user_id)` için ayrıca unique kısıt var?
   <details><summary>Cevap</summary>Postgres'te FK'nın hedefi bir primary key veya unique kısıt olmalı. `(id, user_id)` composite FK'sı için bu ikilinin unique olarak tanımlı olması şart, mantıken zaten unique olsa bile.</details>
4. UUIDv4 yerine UUIDv7 kullanmanın faydası nedir?
   <details><summary>Cevap</summary>v7'nin ilk 48 biti milisaniye cinsinden zaman. Yeni kayıtlar index'in sonuna eklenir, sayfa bölünmesi ve cache kaçırma azalır. ID'ler yaklaşık olarak oluşturulma sırasında sıralanır. Dezavantajı: ID'den oluşturulma zamanı okunabilir.</details>
5. Soft delete'in maliyetleri nelerdir?
   <details><summary>Cevap</summary>Her sorguya filtre eklemek gerekir; unutulursa silinmiş veri görünür. Unique kısıtlar silinmiş satırları da sayar (burada bunu "geri getir" kuralıyla çözdük, alternatif partial unique index). Tablo büyür, bu yüzden kalıcı silme job'ı gerekir. KVKK/GDPR silme talepleri için kalıcı silme yolu şart.</details>
6. Özeti neden SavedLink'te değil Content'te tutuyoruz?
   <details><summary>Cevap</summary>Özet sayfanın içeriğine bağlı, kullanıcıya değil. Content'te tutunca aynı URL'yi kaydeden 100 kişi için AI bir kez çalışır. Kullanıcıya özel olan (başlık override'ı, not, okunma) SavedLink'te kalır.</details>
7. Timestamp hassasiyeti neden önemli?
   <details><summary>Cevap</summary>Postgres varsayılan olarak mikrosaniye, JS Date milisaniye tutar. Cursor'a JS'ten yazılan değer DB'dekiyle eşleşmez; `created_at = cursor` karşılaştırması kayıt atlatabilir. `timestamptz(3)` ikisini eşitliyor.</details>

## Kendini test et

- Content ile SavedLink ayrımını ve hangi alanın neden hangisinde olduğunu anlat.
- B kullanıcısının, A'nın tag'ini kendi linkine bağlamaya çalıştığında veritabanında ne olduğunu adım adım anlat.
- Silinmiş bir linki tekrar kaydedince ne olduğunu ve neden partial unique index'e gerek kalmadığını açıkla.
- Hangi ilişkilerde cascade, hangisinde restrict seçtiğimizi ve nedenini anlat.
