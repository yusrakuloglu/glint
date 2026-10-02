# Prisma ve pgvector

## Ne yaptık

- Lokal geliştirme için docker'da pgvector eklentili bir Postgres çalışıyor.
- API, Prisma 7'nin ESM üreten `prisma-client` generator'ını kullanıyor.
- pgvector, elle yazılmış ilk migration ile açılıyor.
- Veri modeli henüz yok (Faz 2).

## Neden

- **Postgres + pgvector:** İlişkisel veri ve embedding'ler aynı veritabanında duruyor; ayrı bir vector DB gerekmiyor. Supabase de bunu ücretsiz sunuyor. Embedding'ler yerelde üretiliyor ([004](../decisions.md)).
- **Prisma:** Tip güvenli client, migration yönetimi, okunabilir şema. Alternatif olarak Drizzle SQL'e daha yakın ve hafif; Kysely ise yalnızca bir query builder.
- **[011](../decisions.md):**
  - Repo ESM olduğu için ESM client seçildi.
  - Prisma 7 driver adapter zorunlu tuttuğu için `@prisma/adapter-pg` eklendi.
  - Şemada extension tanımı hâlâ deneysel, bu yüzden pgvector elle yazılmış migration ile açılıyor.

## Nasıl çalışıyor

1. **Veritabanı ([docker-compose.yml](../../docker-compose.yml)):**
   - `pgvector/pgvector:pg17` image'ı kullanılıyor.
   - Veri, `glint-db` volume'unda kalıcı.
   - `pnpm db:up` ve `pnpm db:down` ile yönetiliyor.
2. **Generator ([schema.prisma](../../apps/api/prisma/schema.prisma)):**
   - `moduleFormat = "esm"` ve `importFileExtension = "js"`: Üretilen kod, NodeNext'in istediği `.js` uzantılı import'larla geliyor.
   - Çıktı `apps/api/src/generated/prisma` altında, git'e girmiyor; turbo'nun `db:generate` görevi üretiyor.
3. **Config ([prisma.config.ts](../../apps/api/prisma.config.ts)):**
   - Prisma 7 `.env`'i kendisi yüklemiyor. Dosya, kökteki `.env`'i Node'un yerleşik `process.loadEnvFile` fonksiyonuyla okuyor; dotenv'e gerek yok.
   - URL için `env()` yerine `process.env` kullanılıyor. Böylece `prisma generate` URL olmadan da çalışıyor (CI bu sayede veritabanına ihtiyaç duymuyor).
4. **Migration ([enable_pgvector](../../apps/api/prisma/migrations/20261001231137_enable_pgvector/migration.sql)):**
   - Tek satır: `CREATE EXTENSION IF NOT EXISTS vector`.
   - `IF NOT EXISTS` sayesinde Supabase gibi extension'ın zaten açık olduğu ortamlarda da güvenle çalışıyor.
5. **İş akışı:**
   - `prisma migrate dev`: Şemadaki farkı bulur, yeni migration üretir, uygular. Yalnızca geliştirmede kullanılır.
   - `prisma migrate deploy`: Bekleyen migration'ları yalnızca uygular. Prod ve CI için.
6. **Sürüm:** 7.10'a sabit, çünkü npm'de `latest` etiketi 8.0 RC'yi gösteriyor.

## Sınır durumları ve kısıtlar

- Prisma `vector` tipini desteklemiyor. Şemada `Unsupported("vector(384)")` olarak tanımlanacak; okuma ve yazma raw SQL ile yapılacak.
- Benzerlik araması (HNSW indeksi, `<=>` operatörü) Prisma'nın sorgu API'siyle yazılamaz; hibrit arama tamamen SQL olacak (Faz 5).
- `@prisma/adapter-pg` kurulu ama henüz kullanılmıyor (PrismaService Faz 2'de geliyor).
- Elle yazılan migration'larda Prisma'nın drift kontrolü extension'ı göremez. Şema ile veritabanı farkı bu konuda manuel takip edilir.

## Mülakat soruları

1. ORM, query builder ve raw SQL arasındaki trade-off nedir?
   <details><summary>Cevap</summary>ORM tip güvenliği ve hız kazandırır ama karmaşık sorgularda kısıtlar ve verimsiz SQL üretebilir. Query builder SQL'e yakın kalır ve tipli olur. Raw SQL tam kontrol verir ama tip ve bakım yükü sende. Bu projede CRUD için Prisma, arama için raw SQL kullanılacak.</details>
2. `migrate dev` ile `migrate deploy` farkı nedir?
   <details><summary>Cevap</summary>`dev` şemayı veritabanıyla karşılaştırıp yeni migration üretir, gerekirse veritabanını sıfırlamayı önerebilir; geliştirme içindir. `deploy` yalnızca bekleyen migration'ları sırayla uygular, hiçbir şey üretmez ve sıfırlamaz; prod içindir.</details>
3. Migration drift nedir?
   <details><summary>Cevap</summary>Veritabanının gerçek durumunun migration geçmişinden farklılaşması (elle yapılan değişiklik, düzenlenmiş bir migration dosyası vb.). Prisma bunu shadow database ile tespit eder.</details>
4. Embedding nedir, neden vektör olarak saklanır?
   <details><summary>Cevap</summary>Bir metnin anlamını temsil eden sabit uzunlukta sayı dizisi. Anlamca yakın metinlerin vektörleri birbirine yakın olur. Benzerlik bir mesafe ölçüsüyle (cosine vb.) hesaplanabildiği için vektör olarak saklanır.</details>
5. pgvector'deki HNSW ve IVFFlat indeksleri arasındaki fark nedir?
   <details><summary>Cevap</summary>İkisi de yaklaşık en yakın komşu (ANN) indeksi. HNSW graf tabanlıdır; sorgu hızı ve isabeti yüksektir, kurulumu yavaş, belleği fazladır. IVFFlat kümeleme tabanlıdır; hızlı kurulur ama veri eklendikçe yeniden eğitilmesi gerekebilir.</details>
6. Prisma 7'de driver adapter ne değiştirdi?
   <details><summary>Cevap</summary>Rust query engine yerine veritabanı bağlantısı bir JS sürücüsü (burada `pg`) üzerinden kuruluyor. Binary bağımlılık azalıyor ve serverless/edge ortamlarla uyum artıyor.</details>

## Kendini test et

- `pnpm db:migrate`'ten sonra veritabanında neyin nasıl oluştuğunu anlat.
- `prisma generate`'in neden veritabanı URL'si olmadan çalışabildiğini açıkla.
- pgvector'ü neden şemadan değil migration'dan açtığımızı anlat.
