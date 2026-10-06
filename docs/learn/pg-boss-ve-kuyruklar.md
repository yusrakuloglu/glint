# pg-boss ve kuyruklar

## Ne yaptık

- Arka plan işleri için Postgres üzerinde çalışan pg-boss kuyruğunu kurduk. API job gönderiyor, worker (aynı kod tabanında ikinci bir process) job'ları işliyor.
- Her kuyruk tek bir tanımda adını, Zod payload şemasını, tekrar önleme anahtarını ve retry ayarlarını taşıyor.
- İlk gerçek kuyruk `content.extract`: kaydedilen sayfa içeriği bu job ile işlenmeye başlıyor.

## Neden

- **Kuyruk neden gerekli:** Makale çıkarma, AI özeti ve embedding saniyeler ile dakikalar sürüyor. HTTP isteği bunları beklememeli; worker API'den bağımsız ölçeklenebilmeli.
- **Neden Postgres üzerinde:** Zaten Postgres var. Redis eklemek ücretsiz katmanda yeni bir servis demek. Kuyruk veriyle aynı veritabanında olunca job'ı veriyle aynı transaction'da göndermek de mümkün ([idempotent-pipeline](idempotent-pipeline.md)).
- **Değerlendirilen alternatifler:** BullMQ + Redis (ek servis), elle yazılmış `jobs` tablosu (retry, backoff, zamanlama, bakım hepsi yeniden yazılır).
- Karar kayıtları: [002](../decisions.md) (pg-boss), [025](../decisions.md) (worker'ın yeri), [026](../decisions.md) (kurulum).

## Nasıl çalışıyor

1. **İş çekme: `FOR UPDATE SKIP LOCKED`:**
   - Worker, `created` durumundaki job'ları `SELECT ... FOR UPDATE SKIP LOCKED` ile seçip `active` yapıyor.
   - Başka bir worker'ın kilitlediği satırlar beklenmeden atlanıyor. Böylece birden fazla worker aynı job'ı almadan paralel çalışabiliyor.
2. **Kuyruk tanımı ([queue-definition.ts](../../apps/api/src/queue/queue-definition.ts)):** `defineQueue` ile ad, payload şeması, `singletonKey` ve kuyruk ayarları. Örnek: [processing.queues.ts](../../apps/api/src/processing/processing.queues.ts).
3. **`QueueService` ([queue.service.ts](../../apps/api/src/queue/queue.service.ts)):**
   - `send`: payload'u Zod ile doğruluyor, kuyruğu gerekirse oluşturuyor, `singletonKey`'i tanımdan türetiyor, `tx` verilmişse job'ı o transaction'a ekliyor.
   - `work`: job'ı alınca payload'u yeniden doğruluyor ve handler'ı çağırıyor. Handler hata fırlatırsa deneme başarısız sayılıyor ve retry ayarları devreye giriyor.
   - `ensureQueue`: `createQueue` var olan kuyrukta hiçbir şey yapmadığı için değişen ayarlar `updateQueue` ile uygulanıyor. Politika ve partition oluşturulduktan sonra değiştirilemiyor.
4. **İki rol:** `QueueModule.forRoot({ role })`.
   - `api`: pg-boss'u ilk `send`'de başlatıyor. DB'siz unit testler etkilenmiyor.
   - `worker`: açılışta başlatıyor; bakım (süresi dolan job'lar, eski kayıtların silinmesi) ve cron yalnızca burada çalışıyor.
5. **Tekrar önleme: `exclusive` politika + `singletonKey`:**
   - `content.extract`'ın anahtarı `contentId`. Aynı Content için kuyrukta ya da çalışmakta olan bir job varken ikinci `send` `null` dönüyor.
   - pg-boss bunu `(name, singleton_key)` üzerindeki kısmi bir unique index ile yapıyor. Index yalnızca `created`, `retry` ve `active` durumlarını kapsıyor; iş bitince aynı anahtarla yeni job gönderilebiliyor.
6. **Retry ve backoff:** `retryLimit: 5`, `retryDelay: 30`, `retryBackoff: true`. Bekleme yaklaşık `30 × 2^deneme` saniye ve araya rastgelelik (jitter) giriyor; böylece aynı anda düşen işler aynı anda yeniden denenmiyor. Kalıcı hatalar (makale yok gibi) retry edilmeyecek; bu ayrım PR 2'de.
7. **Erteleme:** `startAfter` verilen job o zamana kadar alınmıyor. Kota dolunca kullanılıyor ([ai-kotasi](ai-kotasi.md)).
8. **Ayrı şema:** pg-boss tablolarını `pgboss` şemasında tutuyor ve kendi migration'larını kendisi yönetiyor. Testlerde şema template veritabanına bir kez kuruluyor ([global-setup.ts](../../apps/api/src/testing/integration/global-setup.ts)).

## Sınır durumları ve kısıtlar

- Teslim garantisi at-least-once. Worker job'ı bitirip kaydetmeden çökerse job `expireInSeconds` (varsayılan 15 dk) sonra yeniden çalışıyor; handler'lar idempotent olmalı.
- Polling tabanlı: boşta worker birkaç saniyede bir sorgu atıyor. LISTEN/NOTIFY opsiyonel ve kapalı; işler saniyeler mertebesinde gecikmeyi tolere ediyor.
- Supabase'in transaction pooler'ı (PgBouncer) session'a bağlı özellikleri bozabilir; worker doğrudan bağlantı kullanmalı (Faz 8'de deploy sırasında doğrulanacak).
- Payload pg-boss tablosunda ve arşivinde saklanıyor. Büyük veri (ham HTML) bu yüzden payload'a konmuyor, yalnızca `contentId` gönderiliyor.
- `@opentelemetry/api` zorunlu peer; SDK kaydedilmedikçe telemetry no-op.

## Mülakat soruları

1. Neden Redis yerine Postgres üzerinde bir kuyruk?
   <details><summary>Cevap</summary>Ek servis yok, yedekleme ve izleme tek yerde, job veriyle aynı transaction'da gönderilebiliyor. Bedeli: çok yüksek iş hacminde Postgres'e yük ve polling gecikmesi. Bu projenin hacmi için yeterli.</details>
2. `SKIP LOCKED` ne işe yarar?
   <details><summary>Cevap</summary>`FOR UPDATE` ile kilitlenmiş satırları beklemek yerine atlar. Birden fazla tüketici aynı tablodan iş çekerken birbirini bloklamadan farklı satırları alır; kuyruk olarak tablo kullanmanın temel tekniği.</details>
3. `singletonKey` ile `exclusive` politika birlikte neyi garanti eder, neyi etmez?
   <details><summary>Cevap</summary>Aynı anahtarla aynı anda kuyrukta veya çalışmakta tek job olmasını garanti eder. Aynı işin iki kez çalışmamasını garanti etmez: job bitip tekrar gönderilebilir ya da at-least-once teslimle yeniden çalışabilir. Bu yüzden adımlar ayrıca idempotent olmalı.</details>
4. Exponential backoff'a neden jitter eklenir?
   <details><summary>Cevap</summary>Aynı anda başarısız olan işler (ör. sağlayıcı 429 verdiğinde) aynı anda yeniden denenirse yine aynı anda çarpar (thundering herd). Rastgele sapma denemeleri zamana yayar.</details>
5. Payload'u neden hem gönderirken hem alırken doğruluyorsun?
   <details><summary>Cevap</summary>Gönderirken: hatalı veri kuyruğa hiç girmesin, hata çağıran yerde görünsün. Alırken: kuyrukta bekleyen job eski bir şemayla yazılmış olabilir ya da elle eklenmiş olabilir; handler doğrulanmamış veriye güvenmemeli.</details>
6. Bakım ve cron neden yalnızca worker'da çalışıyor?
   <details><summary>Cevap</summary>Bu işler veritabanı geneli ve tek yerde çalışması yeterli. Her API instance'ında çalışsa gereksiz sorgu yükü olur. API yalnızca üretici; tembel başlatma DB'ye ihtiyacı olmayan testleri de bağımsız tutuyor.</details>
7. Kuyruk ayarını (ör. `retryLimit`) değiştirdin, deploy ettin. Mevcut kuyruk ne olur?
   <details><summary>Cevap</summary>`createQueue` var olan kuyruğa dokunmaz; `ensureQueue` ayarları `updateQueue` ile uygular. Politika ve partition değiştirilemez; onlar için yeni bir kuyruk adı gerekir.</details>

## Kendini test et

- Bir sayfa kaydedildiğinde `content.extract` job'ının oluşmasından worker'ın onu almasına kadar olanları anlat.
- Aynı URL'yi üç kullanıcı aynı anda kaydederse neden tek job oluştuğunu iki katmanla açıkla (sahiplenme ve `singletonKey`).
- API ve worker rollerinin farkını ve neden API'nin pg-boss'u tembel başlattığını açıkla.
