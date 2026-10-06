# Idempotent pipeline

> Faz 3, PR 1 itibarıyla: kuyruğa transaction içinde gönderim ve güvenli kapanış. Adımların koşullu yazması ve reconciler PR 2 ve 3'te bu dokümana eklenecek.

## Ne yaptık

- Job, veriyi yazan Prisma transaction'ının içinde kuyruğa konuyor: `QueueService.send(queue, payload, { tx })`. Transaction commit edilirse veri ve job birlikte var oluyor, geri alınırsa ikisi de yok.
- Worker kapanırken önce çalışan job'ları bitirmesi bekleniyor, veritabanı bağlantısı en son kapanıyor.
- Mutation check, kapanış sırasındaki bir bağlantı sızıntısını yakaladı ve test buna göre güçlendirildi.

## Neden

- **Dual write problemi:** "Content'i yaz" ve "job gönder" iki ayrı işlemse araya bir çökme girebilir. Ya veri yazılır ama job hiç gönderilmez (Content sonsuza dek `PENDING` kalır), ya da job gönderilir ama veri geri alınır (job olmayan bir kaydı işlemeye çalışır).
- **Değerlendirilen alternatifler:**
  - **Transactional outbox:** Veriyle aynı transaction'da bir `outbox` tablosuna satır yazılır; ayrı bir relay bu satırları okuyup kuyruğa/broker'a taşır. Kuyruk başka bir sistemdeyse (Kafka, SQS) standart çözüm budur. Bedeli ek bir tablo, bir relay process'i ve relay'in kendi at-least-once teslimi.
  - **`fromPrisma(tx)`:** pg-boss kuyruğu zaten aynı Postgres'te. pg-boss 12'nin Prisma adapter'ı, `send`'i Prisma'nın interactive transaction'ı üzerinden çalıştırıyor, yani job satırı veriyle aynı transaction'a giriyor. pg-boss'un job tablosu outbox'ın kendisi gibi davranıyor; relay gerekmiyor.
  - Planda bunun mümkün olmayacağını varsaymıştık (Prisma ham bir pg client vermiyor); adapter `$queryRawUnsafe` üzerinden çalıştığı için gerekmedi.
- Karar kaydı: [026](../decisions.md). Kuyruk seçimi: [002](../decisions.md).

## Nasıl çalışıyor

1. **Transaction içinde gönderim ([queue.service.ts](../../apps/api/src/queue/queue.service.ts), `send`):**
   - Payload kuyruk tanımındaki Zod şemasıyla doğrulanıyor ([queue-definition.ts](../../apps/api/src/queue/queue-definition.ts)).
   - `tx` verilmişse pg-boss'a `db: fromPrisma(tx)` geçiliyor; job insert'ü o transaction'da çalışıyor.
   - Kuyruğun oluşturulması (`createQueue`) transaction dışında, process başına bir kez yapılıyor.
2. **Teslim garantisi at-least-once:** Transaction gönderimi "job kaybolmaz" garantisini veriyor, "job bir kez çalışır" garantisini vermiyor. Worker job'ı bitirip `complete` yazmadan çökerse job süre aşımından sonra tekrar çalışır. Bu yüzden adımların idempotent olması hâlâ şart (PR 2).
3. **Kapanış sırası:**
   - Nest kapanışta önce tüm modüllerin `onModuleDestroy`'unu, en son `onApplicationShutdown`'u çağırıyor.
   - `QueueService.onModuleDestroy`: `boss.stop({ graceful: true })` yeni job almayı kesiyor ve çalışan handler'ları 30 sn'ye kadar bekliyor.
   - `PrismaService.onApplicationShutdown` ([prisma.service.ts](../../apps/api/src/prisma/prisma.service.ts)): bağlantı ancak handler'lar bittikten sonra kapanıyor.
4. **Mutation check'in bulduğu sızıntı:**
   - İlk testte Prisma'nın kapanışı kasıtlı olarak `onModuleDestroy`'a geri alındı ve test yine geçti.
   - Sebep 1: Testteki modül sırasında Queue zaten Prisma'dan önce kapanıyordu; sıra import sırasına bağlıydı, garanti değildi.
   - Sebep 2 (asıl ders): Prisma `$disconnect`'ten sonra gelen bir sorguda hata vermiyor, **sessizce yeni bir pool açıyor**. Handler "çalışıyor" gibi görünüyor ama açılan pool hiç kapanmıyor; process bağlantıyı açık bırakıyor, Postgres'te boşta bağlantı birikiyor.
   - Düzeltilmiş test ([queue.int-spec.ts](../../apps/api/src/queue/queue.int-spec.ts)): Modüller ters sırada import ediliyor ve kapanıştan sonra `pg_stat_activity`'de test veritabanına açık bağlantı kalmadığı kontrol ediliyor. Artık hatalı sıra testi kırıyor.

## Sınır durumları ve kısıtlar

- Transaction içinde gönderim yalnızca kuyruk aynı veritabanındayken çalışıyor. Kuyruk ayrı bir sisteme taşınırsa outbox gerekir.
- Graceful stop 30 sn ile sınırlı. Deploy ortamındaki `stop_grace_period` bundan kısaysa process SIGKILL ile kesilir ve job yarıda kalır (roadmap Faz 8). Yarıda kalan job süre aşımıyla tekrar çalışır; idempotent adımlar bunu tolere eder.
- `fromPrisma` interactive transaction (`$transaction(async (tx) => ...)`) ister; batch transaction (`$transaction([...])`) ile kullanılamaz.

## Mülakat soruları

1. Dual write problemi nedir?
   <details><summary>Cevap</summary>Bir işlemin iki ayrı sisteme (ör. veritabanı ve mesaj kuyruğu) yazması. İkisi atomik değilse aradaki bir çökme tutarsızlık bırakır: biri yazılır, diğeri yazılmaz.</details>
2. Transactional outbox nasıl çalışır?
   <details><summary>Cevap</summary>Mesaj, veriyle aynı transaction'da bir outbox tablosuna yazılır. Ayrı bir relay (polling ya da CDC) outbox'ı okuyup mesajı broker'a gönderir ve gönderildi olarak işaretler. Relay at-least-once gönderir, tüketiciler idempotent olmalıdır.</details>
3. Burada neden outbox kullanmadık?
   <details><summary>Cevap</summary>Kuyruk (pg-boss) zaten aynı Postgres'te. Job satırı veriyle aynı transaction'da yazılabildiği için job tablosu outbox'ın işini görüyor; ek tablo ve relay gereksiz.</details>
4. At-least-once ile exactly-once arasındaki fark nedir? Exactly-once pratikte nasıl elde edilir?
   <details><summary>Cevap</summary>At-least-once: mesaj kaybolmaz ama tekrar teslim edilebilir. Dağıtık sistemde gerçek exactly-once teslim pratikte yoktur; "etkisi bir kez" (effectively once) at-least-once teslim + idempotent tüketici ile elde edilir.</details>
5. Graceful shutdown'da kaynakları hangi sırayla kapatırsın?
   <details><summary>Cevap</summary>Önce yeni iş almayı kes (HTTP'de dinlemeyi, kuyrukta fetch'i durdur), sonra çalışan işleri bekle, en son bu işlerin kullandığı kaynakları (DB pool) kapat. Ters sıra, çalışan işin altından bağlantıyı çeker.</details>
6. Kapanış sırası yanlışken test neden geçti, nasıl düzelttin?
   <details><summary>Cevap</summary>Modül sırası tesadüfen doğruydu ve Prisma kapandıktan sonra gelen sorguda hata vermeyip yeniden bağlanıyordu. Testte modül sırasını ters çevirdim ve kapanıştan sonra açık bağlantı sayısının sıfır olduğunu `pg_stat_activity`'den kontrol ettim; böylece sızıntı görünür oldu.</details>
7. pg-boss'u Prisma transaction'ına katmanın bir dezavantajı var mı?
   <details><summary>Cevap</summary>Transaction süresi job insert'ü kadar uzar ve kuyruk aynı veritabanına bağımlı kalır. Ayrıca adapter yalnızca interactive transaction ile çalışır; uzun interactive transaction'lar bağlantı tutar, kısa tutulmalıdır.</details>

## Kendini test et

- Content yazılıp job gönderilmeden process çökerse eski ve yeni tasarımda ne olduğunu anlat.
- `onModuleDestroy` ve `onApplicationShutdown` sırasını ve hangi servisin hangisinde kapandığını gerekçesiyle açıkla.
- Prisma'nın `$disconnect` sonrası davranışının neden bir sızıntıya yol açtığını ve testin bunu nasıl yakaladığını anlat.
- Transaction gönderiminin neden idempotent adımları gereksiz kılmadığını açıkla.
