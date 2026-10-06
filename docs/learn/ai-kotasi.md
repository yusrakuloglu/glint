# Günlük AI kotası

## Ne yaptık

- Her kullanıcının günde başlatabileceği AI işleme sayısı sınırlı (`AI_DAILY_LIMIT_PER_USER`, varsayılan 50, UTC günü). Hazır içeriği kaydetmek kotadan bir şey düşmüyor.
- Gün doluysa kayıt reddedilmiyor; iş kotası boş ilk güne erteleniyor. `AI_MAX_DEFER_DAYS` (varsayılan 7) gün boyunca yer yoksa 429.
- Ertelenen işlerin snapshot'ları beklerken yer kaplamasın diye HTML `script`/`style`'dan arındırılıp gzip ile saklanıyor.

## Neden

- **Problem:** Gemini ve Groq'un ücretsiz katmanlarında istek limitleri var. Tek bir kullanıcı toplu içe aktarmayla tüm kotayı tüketip diğerlerini bekletebilir.
- **Neden reddetmek değil ertelemek:** Eklenti sayfa içeriğini kayıt anında gönderiyor. Reddedilen kayıtta sayfa içeriği kaybolur; kullanıcı sayfayı yeniden açmak zorunda kalır.
- **Neden ertelenen iş çalıştığı günden düşülüyor:** Plan ilk başta "ertesi güne ertele" diyordu. Ama ertelenen iş ertesi günün kotasından düşülmezse bir günde sınırsız iş biriktirilip ertesi güne yığılabilirdi; limit fiilen kalkardı.
- **Neden pencere 7 gün ve sıkıştırma:** Bekleyen her iş snapshot'ını saklıyor. Üst sınır `50 × 7 = 350` snapshot; 5 MB'lık ham HTML ile tek kullanıcı 1,75 GB'a çıkabilirdi (Supabase ücretsiz katmanı 500 MB).
- Karar kaydı: [028](../decisions.md). İçerik paylaşımı: [005](../decisions.md).

## Nasıl çalışıyor

1. **Atomik rezervasyon ([ai-quota.service.ts](../../apps/api/src/processing/ai-quota.service.ts), `reserve`):**
   - Tek sorgu: `INSERT ... VALUES (..., 1) ON CONFLICT (user_id, day) DO UPDATE SET count = count + 1 WHERE count < limit RETURNING count`.
   - Satır yoksa ekleniyor; varsa ve limit altındaysa artıyor; limitteyse `WHERE` güncellemeyi engelliyor ve sorgu satır dönmüyor.
   - Postgres satırı kilitlediği için eşzamanlı iki istek aynı son hakkı alamıyor.
2. **Gün arama:** Bugünden başlayıp `AI_MAX_DEFER_DAYS` gün boyunca ilk boş gün aranıyor. Bulunan gün bugünse job hemen, değilse o günün 00:00 UTC'sinde (`startAfter`) başlıyor.
3. **Transaction ([content-ingest.service.ts](../../apps/api/src/processing/content-ingest.service.ts)):** Content'i sahiplenme, kota rezervasyonu, snapshot ve job tek transaction'da. 429 olursa hepsi geri alınıyor, Content `AWAITING_CONTENT`'te kalıyor.
4. **UTC gün hesabı ([utc-day.ts](../../apps/api/src/processing/utc-day.ts)):** Gün sınırı sunucunun saat dilimine göre değil, UTC'ye göre. Tarih SQL'e `YYYY-MM-DD` metni olarak gidiyor; böylece `date` kolonunda saat dilimi kayması olmuyor.
5. **Snapshot depolama ([page-snapshot.ts](../../apps/api/src/processing/page-snapshot.ts)):**
   - `stripScriptsAndStyles`: Tek geçişli regex yorumları ve `script`/`style` elementlerini soldan sağa tarıyor; yorumları bırakıyor, diğerlerini siliyor. Script ve style "raw text" elementleri olduğu için içerikleri ilk kapanış etiketinde bitiyor; bu yüzden regex burada güvenilir.
   - `compressSnapshotHtml`: gzip, async (event loop'u bloklamasın) ve transaction dışında (transaction bağlantı tutuyor).
6. **Testler:**
   - [ai-quota.int-spec.ts](../../apps/api/src/processing/ai-quota.int-spec.ts): ücretlendirme, ücretsiz durumlar, erteleme günü, pencerenin son günü, kullanıcı başına ayrım, 429 ile geri alma.
   - Eşzamanlılık testi kalan 5 hak için 20 transaction'ı yarıştırıyor. Mutation check'te 3 HTTP isteğiyle yazılan ilk sürüm "önce oku, sonra artır" hatasını yakalamamıştı; istekler gerçekte aynı anda yürümüyordu.

## Sınır durumları ve kısıtlar

- Paylaşılan bir Content'i ilk tetikleyen kullanıcının kotası harcanıyor; diğerleri ücretsiz yararlanıyor. Bilinçli bir tercih.
- Ertelenen bir Content `PENDING` durumunda bekliyor. Aynı URL'yi kaydeden başka kullanıcıların sayfası yok sayılıyor; onlar da ertelenen günü bekliyor, kendi kotalarıyla işi öne çekemiyorlar.
- Kota "başlatılan işlem" sayıyor, token saymıyor. Uzun ve kısa makale aynı hakkı harcıyor.
- Regex `<script>` içinde `</script>` metni geçen nadir durumda erken biter; tarayıcı da aynı şekilde davranır. Kapanmamış bir script olduğu gibi kalır.
- Sıkıştırma oranları gerçek sayfalarda henüz ölçülmedi (Faz 8).

## Mülakat soruları

1. Bir sayacı limitle birlikte atomik olarak nasıl artırırsın?
   <details><summary>Cevap</summary>Kontrolü ve artırmayı tek koşullu yazmada yap: `UPDATE ... SET count = count + 1 WHERE count < limit` (satır yoksa `INSERT ... ON CONFLICT`). Etkilenen satır sayısı ya da `RETURNING` sonucu başarıyı söyler. Önce okuyup sonra yazmak iki istek arasında yarış bırakır.</details>
2. "Önce oku, sonra artır" neden yanlış, hangi izolasyon seviyesi bunu çözer?
   <details><summary>Cevap</summary>İki transaction aynı anda 49 okur, ikisi de 50'ye yazar ve limit aşılır (lost update / write skew). `SERIALIZABLE` çatışmayı yakalayıp birini hata ile düşürür ama retry gerekir. Koşullu yazma `READ COMMITTED`'da da doğru çalışır çünkü satır kilidi sonrası `WHERE` yeniden değerlendirilir.</details>
3. Kota dolunca neden reddetmek yerine erteliyorsun?
   <details><summary>Cevap</summary>Sayfa içeriği kayıt anında geliyor ve yeniden üretilemiyor. Reddetmek veri kaybı demek; ertelemek sadece gecikme. Sınırsız birikimi önlemek için erteleme penceresi ve sonrasında 429 var.</details>
4. Günlük kotada saat dilimi nasıl ele alınır?
   <details><summary>Cevap</summary>Tek bir referans seçilir (UTC) ve tüm hesaplar ona göre yapılır. Sunucunun yerel saati kullanılmaz. Tarih DB'ye saat bilgisi taşımayan bir değer (`YYYY-MM-DD`) olarak gider; aksi halde `Date` → `date` dönüşümü dilime göre bir gün kayabilir.</details>
5. HTML'i neden regex ile temizlemek genelde kötü, burada neden kabul edilebilir?
   <details><summary>Cevap</summary>HTML iç içe ve bağlama duyarlı; genel temizlik (sanitize) için parser gerekir. Burada amaç güvenlik değil depolama: yalnızca script/style siliniyor ve bunların içeriği spec gereği ilk kapanış etiketinde bitiyor. Yorumlar aynı geçişte eşleştirildiği için yorumun içindeki etiketler yanlış eşleşmiyor. Güvenlik sanitize'ı render sırasında yapılıyor.</details>
6. Büyük veriyi neden job payload'una koymadın?
   <details><summary>Cevap</summary>pg-boss payload'u job tablosunda ve tamamlanan işler silinene kadar saklıyor; büyük payload kuyruğu yavaşlatır ve tabloyu şişirir. Veri ayrı tabloda, payload'da yalnızca kimlik var.</details>

## Kendini test et

- Kota dolu bir kullanıcının kaydında `reserve`'den `startAfter`'a kadar olanları anlat.
- 20 eşzamanlı rezervasyonda neden tam olarak 5'inin bugüne düştüğünü açıkla.
- Depolama üst sınırını env değişkenleriyle hesapla ve hangi önlemlerin bu sınırı düşürdüğünü söyle.
- Regex'in yorum ve script'i neden tek geçişte eşleştirdiğini bir örnekle göster.
