# URL normalizasyonu

## Ne yaptık

- Kullanıcının girdiği URL'yi kanonik bir biçime çeviren saf bir fonksiyon yazıldı: `normalizeUrl`.
- Content tablosunda benzersizlik bu biçime göre sağlanıyor. Böylece `?utm_source=twitter` ile gelen link ile sade link aynı Content'i paylaşıyor.
- Kurallar bilinçli olarak muhafazakâr: şüpheli durumlarda URL'ye dokunulmuyor.

## Neden

- Özetler URL bazında paylaşılıyor ([005](../decisions.md)). Normalizasyon olmazsa aynı sayfa için her paylaşım linki ayrı bir AI çağrısı olur.
- İki hata yönü var:
  - **Az normalizasyon:** Aynı sayfa iki kez işlenir. Maliyet artar ama yanlış bilgi yok.
  - **Fazla normalizasyon:** Farklı iki sayfa birleşir ve kullanıcı başka sayfanın özetini görür.
- İkincisi daha kötü olduğu için çizgi muhafazakâr tarafta çekildi ([017](../decisions.md)).
- `normalize-url` paketi değerlendirildi. Varsayılanları agresif (`www.` ve sondaki `/` siliniyor) ve bağımlılık eklemeye değmedi.

## Nasıl çalışıyor

Kod: [normalize-url.ts](../../apps/api/src/links/normalize-url.ts), testler: [normalize-url.spec.ts](../../apps/api/src/links/normalize-url.spec.ts).

1. **Parse:** WHATWG `new URL()`. Bu adım şunları zaten yapıyor:
   - scheme ve host'u küçük harfe çeviriyor,
   - IDN'yi punycode'a çeviriyor (`bücher.example` → `xn--bcher-kva.example`),
   - varsayılan portu siliyor,
   - path'i percent-encode ediyor.
2. **Reddetme:** Şu durumlarda `InvalidUrlError` fırlatılıyor; hangi kuralın tetiklendiği `reason` alanında:
   - `http`/`https` dışındaki scheme'ler (`javascript:`, `file:`),
   - `user:pass@` içeren URL'ler (kimlik bilgisi veritabanına yazılmasın),
   - normalizasyondan sonra 2048 karakteri aşan URL'ler.
3. **Host:** Sondaki nokta siliniyor (`example.com.` → `example.com`).
4. **Query (`normalizeSearch`):**
   - Ham `&` segmentleri üzerinde çalışıyor.
   - `utm_*` ve bilinen click id'ler (`fbclid`, `gclid`, ...) siliniyor. Karşılaştırmada büyük/küçük harf fark etmiyor.
   - Kalanlar key'e göre sıralanıyor. Sıralama stabil: aynı key'in değerleri kendi aralarında yer değiştirmiyor (`?t=2&t=1` anlamlı olabilir).
   - `URLSearchParams` bilinçli olarak kullanılmadı, çünkü değerleri yeniden encode ediyor: `/` → `%2F`, `%20` → `+`, `?a` → `?a=`. Bu URL'yi değiştirir.
5. **Fragment:** Siliniyor. İstisna: `#!` ve `#/`. Eski SPA'larda rota fragment'ta duruyor, yani farklı sayfa demek.
6. **Dokunulmayanlar:**
   - Path'in büyük/küçük harfi: sunucular path'te harfe duyarlı olabilir.
   - Sondaki `/`: `/a` ile `/a/` farklı kaynak olabilir.
   - `www.`: teknik olarak farklı host.
   - http/https: aynı içerik garanti değil.
7. **İdempotent:** `normalizeUrl(normalizeUrl(x)) === normalizeUrl(x)`. Bunu da bir test doğruluyor.

## Sınır durumları ve kısıtlar

- `example.com/a` ile `example.com/a/` ayrı Content olur. İleride eklentinin gönderdiği `<link rel="canonical">` ile birleştirilebilir.
- Tracking listesi sabit. Yeni bir platformun parametresi (örn. `si`) listede yoksa tekrar oluşur.
- Kısaltılmış linkler (`t.co`, `bit.ly`) çözülmüyor. Sunucuda istek atmıyoruz ([003](../decisions.md)); eklenti son URL'yi gönderecek.
- `ref` gibi bazen anlamlı, bazen izleme amaçlı parametreler korunuyor.
- 2048 sınırı: normalize URL ASCII olduğundan B-tree index'in satır başına ~2700 baytlık sınırının altında kalıyor.

## Mülakat soruları

1. URL normalizasyonu neden gerekli?
   <details><summary>Cevap</summary>Aynı kaynağı gösteren farklı yazımları (büyük harfli host, tracking parametresi, fragment) tek anahtara indirmek için. Burada amaç, aynı sayfa için özet ve embedding'i bir kez üretmek.</details>
2. Neden `www.` ve sondaki `/` silinmiyor?
   <details><summary>Cevap</summary>Teorik olarak farklı kaynaklar olabilirler. Yanlış birleştirme (kullanıcıya başka sayfanın özeti) tekrar işlemeden daha zararlı. Muhafazakâr kural, maliyeti doğruluğa tercih ediyor.</details>
3. `URLSearchParams` ile sıralama yapmak neden URL'yi bozabilir?
   <details><summary>Cevap</summary>Serileştirirken `application/x-www-form-urlencoded` kurallarını uygular: boşluk `+` olur, `/` `%2F` olur, değersiz parametreye `=` eklenir. Bazı sunucular bunları farklı yorumlar. Ham segmentleri sıralamak orijinal encoding'i korur.</details>
4. Aynı key'li parametreler sıralanırken neden sıraları korunuyor?
   <details><summary>Cevap</summary>`?tag=a&tag=b` bazı uygulamalarda sıralı liste demektir. Sıralarını değiştirmek anlamı değiştirebilir. Bu yüzden yalnızca key'e göre stabil sıralama yapılıyor.</details>
5. Kullanıcı bilgisi içeren URL'ler neden reddediliyor?
   <details><summary>Cevap</summary>`https://user:pass@host` kimlik bilgisini veritabanına, loglara ve paylaşılan Content'e taşır. Content başka kullanıcılarla paylaşıldığı için bu bir veri sızıntısı olur.</details>
6. Bu fonksiyon neden saf (pure) yazıldı?
   <details><summary>Cevap</summary>Girdi ve çıktı dışında yan etkisi yok. Tablo bazlı unit testlerle her kuralı tek tek doğrulamak kolay, ileride eklentide de aynı mantıkla tekrar kullanılabilir.</details>

## Kendini test et

- `HTTPS://Example.com:443/a?utm_source=x&b=2&a=1#top` girdisinin her adımda nasıl değiştiğini anlat.
- Az ve fazla normalizasyonun hangi hatalara yol açtığını ve hangisini neden tercih ettiğimizi açıkla.
- Hangi URL'lerin neden reddedildiğini say.
