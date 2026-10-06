# Cursor pagination

## Ne yaptık

- `GET /links` kullanıcının linklerini en yeniden eskiye sayfalıyor.
- Sayfa numarası (offset) yerine, son öğenin konumunu taşıyan opak bir **cursor** kullanılıyor.
- Yanıt `{ items, nextCursor }`. `nextCursor` null ise son sayfaya gelinmiş demek.

## Neden

- **Offset'in sorunları:**
  - `OFFSET 10000`, veritabanının 10.000 satırı okuyup atması demek. Derin sayfalar yavaşlıyor.
  - Kullanıcı sayfalar arasında gezinirken yeni link eklenirse kayıtlar kayıyor: aynı link iki kez görünüyor ya da biri atlanıyor.
- **Cursor (keyset):** "Şu satırdan sonrakiler" sorgusu index üzerinden doğrudan o noktaya atlıyor. Hız sayfa derinliğinden bağımsız.
- Faz 4'teki sanallaştırılmış sonsuz liste de tam bu modeli istiyor.
- Karar kaydı: [022](../decisions.md).

## Nasıl çalışıyor

1. **Sıralama:**
   - `ORDER BY created_at DESC, id DESC`.
   - `created_at` tek başına benzersiz değil; aynı milisaniyede kaydedilen linkler olabilir. `id` bu durumda sırayı belirliyor (tie-breaker).
2. **Cursor ([cursor.ts](../../apps/api/src/common/pagination/cursor.ts)):**
   - Son öğenin `{ v: 1, createdAt, id }` bilgisi JSON olarak base64url ile kodlanıyor.
   - Client için anlamsız bir string; iç yapısı değişebilir. `v` alanı ileride format değişikliğine izin veriyor.
   - `cursorParamSchema` decode edip Zod ile doğruluyor. Bozuk cursor `query.cursor` yoluyla 400 alıyor.
3. **Sorgu (`LinksService.list`, [links.service.ts](../../apps/api/src/links/links.service.ts)):**
   - Koşul: `created_at < c OR (created_at = c AND id < i)`. Prisma tuple karşılaştırmasını (`(a, b) < (x, y)`) desteklemediği için OR ile yazılıyor.
   - `user_id` ve `deleted_at IS NULL` koşulları her zaman ekleniyor. Başka kullanıcının cursor'u yalnızca bir konum bilgisi; veri sızdırmıyor.
4. **Sonraki sayfa var mı (`toPage`):**
   - `limit + 1` satır çekiliyor. Fazladan satır geldiyse bir sonraki sayfa var; o satır yanıta eklenmiyor.
   - Ayrıca bir `COUNT` sorgusu gerekmiyor.
5. **Index:**
   - Migration'daki `(user_id, created_at DESC, id DESC)` index'i hem filtreyi hem sıralamayı karşılıyor; sıralama için ayrı bir adım gerekmiyor.
6. **Zaman hassasiyeti:**
   - Kolonlar `timestamptz(3)`, yani JS `Date` ile aynı milisaniye hassasiyetinde.
   - Postgres varsayılanı mikrosaniye olsaydı, cursor'daki değer DB'dekinden farklı olur ve eşitlik koşulu satır atlatırdı.

## Sınır durumları ve kısıtlar

- Yalnızca ileri gidiliyor. "Önceki sayfa" veya "5. sayfaya atla" yok; sonsuz liste için gerekmiyor.
- Toplam sayı dönmüyor. Gerekirse ayrı ve cache'lenebilir bir uç olmalı.
- Silinen bir link sonraki sayfalardan da kayboluyor. Cursor'ın gösterdiği link silinmiş olsa bile sorgu çalışıyor, çünkü cursor bir satırı değil bir konumu gösteriyor.
- Tekrar kaydedilen link `createdAt`'i yenilendiği için listenin başına geçiyor. O sırada gezinen biri onu ikinci kez görmeyebilir ya da görebilir; kabul edilebilir.
- Farklı bir sıralama (başlığa göre vb.) eklenirse cursor'a o alan da girmeli ve yeni bir index gerekir.

## Mülakat soruları

1. Offset ile cursor pagination arasındaki fark nedir?
   <details><summary>Cevap</summary>Offset "ilk N satırı atla" der; veritabanı o satırları yine okur ve veri değişince sayfalar kayar. Cursor "şu değerden sonrakileri ver" der; index'te doğrudan o noktaya gider ve araya eklenen kayıtlardan etkilenmez. Cursor'da rastgele sayfaya atlanamaz.</details>
2. Neden yalnızca `created_at`'e göre sıralamak yetmez?
   <details><summary>Cevap</summary>Aynı zaman damgalı iki satır olabilir. Sayfa sınırı bu ikisinin arasına denk gelirse `created_at < c` koşulu ikincisini atlar, `<=` ise tekrar gösterir. Benzersiz bir ikinci alan (`id`) toplam bir sıralama sağlar.</details>
3. Cursor neden opak tutulur?
   <details><summary>Cevap</summary>Client iç yapıya bağımlı olmasın diye. Format değişince (yeni sıralama, yeni alan) client'ı kırmadan değiştirilebilir. Client'ın kendi cursor üretmesi de engellenir.</details>
4. Cursor'ı client gönderdiğine göre güvenlik riski var mı?
   <details><summary>Cevap</summary>Cursor yalnızca bir konum taşıyor; sorgu her zaman `user_id` ile sınırlı. Değerler Zod ile doğrulanıyor (uuid, ISO tarih) ve parametre olarak geçiyor, SQL injection yok. Başka kullanıcının cursor'u sadece kendi listende bir konum demek.</details>
5. "limit + 1" tekniği ne işe yarar?
   <details><summary>Cevap</summary>Bir satır fazla çekilir. Gelirse sonraki sayfa var demektir; o satır yanıttan çıkarılır. Toplam sayıyı bulmak için ayrı bir `COUNT(*)` sorgusuna gerek kalmaz.</details>
6. Bu sorguyu hangi index karşılar, neden sütun sırası önemli?
   <details><summary>Cevap</summary>`(user_id, created_at DESC, id DESC)`. Önce eşitlik filtresi (`user_id`), sonra sıralama alanları gelir. Böylece Postgres tek bir index taramasıyla hem filtreler hem sıralı okur. Sıra farklı olsaydı ek bir sort adımı gerekirdi.</details>

## Kendini test et

- İkinci sayfanın sorgusunu cursor'daki değerlerle birlikte yaz ve neden doğru olduğunu anlat.
- Aynı milisaniyede kaydedilmiş 7 linkin 2'şerli sayfalarda nasıl atlanmadan geldiğini göster.
- `timestamptz(3)` seçiminin pagination ile ilişkisini açıkla.
