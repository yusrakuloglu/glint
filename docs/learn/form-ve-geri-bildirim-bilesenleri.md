# Form ve geri bildirim bileşenleri

## Ne yaptık

Üç bileşen yazdık:

- **`TextField`:** Label, açıklama ve hata mesajını input'a otomatik bağlıyor; altında stillendirilmiş bir `Input` var.
- **`Skeleton`:** Yükleme sırasında içeriğin yerini tutan dekoratif bir kutu.
- **`EmptyState`:** "Henüz link yok" gibi boş ekranlar için başlık, açıklama ve aksiyon düzeni.

## Neden

- **TextField:** Form erişilebilirliğinin en sık bozulan kısmı, label ile input'un ve hata mesajının input'la bağlantısı. Bu bağlantıyı her formda elle kurmak yerine bileşen kuruyor. Placeholder label yerine geçmez: yazmaya başlayınca kaybolur ve kontrastı düşüktür. Bu yüzden `label` zorunlu.
- **Native `<label>`:** Plandaki Radix `Label` yerine native `<label htmlFor>` kullanıldı. Radix Label yalnızca çift tıklamada metin seçimini engelliyor; buna karşılık client JS ekliyor.
- **Skeleton:** Spinner'a göre içeriğin şeklini önceden gösterdiği için algılanan bekleme süresini kısaltıyor ve layout kaymasını azaltıyor.
- **EmptyState:** Boş ekran, kullanıcıya bir sonraki adımı göstermek için bir fırsat ("İlk linkini kaydet").

## Nasıl çalışıyor

1. **`Input` ([input.tsx](../../packages/ui/src/components/input/input.tsx)):**
   - Token renkleri ve focus halkası kullanılıyor.
   - `aria-invalid` olunca kenarlık `danger` rengine dönüyor (Tailwind'in `aria-invalid:` variant'ı).
2. **`TextField`, aynı dosyada:**
   - `useId` ile benzersiz bir id üretiliyor; açıklama ve hata için `-description` ve `-error` ekli id'ler türetiliyor.
   - `aria-describedby` birleştiriliyor: önce çağıranın verdiği id, sonra açıklama, en son hata. Böylece ekran okuyucu "açıklama, hata" sırasıyla okuyor ve dışarıdan verilen açıklama kaybolmuyor.
   - Hata varsa `aria-invalid` ekleniyor.
   - `required` native olarak input'a gidiyor (ekran okuyucu "zorunlu" der); yıldız işareti `aria-hidden`, yalnızca görsel.
   - `useId` bir hook olduğu için dosya `'use client'`.
3. **`Skeleton` ([skeleton.tsx](../../packages/ui/src/components/skeleton/skeleton.tsx)):**
   - `aria-hidden`; ekran okuyucu boş kutuları okumuyor.
   - `motion-safe:animate-pulse`: hareket azaltma tercihi açıksa animasyon yok.
   - Önerilen kullanım story'de: yüklenen bölge `aria-busy="true"` ve içinde `sr-only` bir "yükleniyor" metni var.
4. **`EmptyState` ([empty-state.tsx](../../packages/ui/src/components/empty-state/empty-state.tsx)):**
   - `headingLevel` (2–4) ile sayfanın başlık hiyerarşisine uyuyor; ikon `aria-hidden`.
   - Hook kullanmadığı için Server Component olarak kalıyor (`'use client'` yok). Skeleton da öyle.
5. **Testler:**
   - TextField: label'a tıklayınca focus, erişilebilir açıklamanın sırası, `aria-invalid`, `required`, disabled'ın Tab sırasından çıkması, dışarıdan verilen `aria-describedby`'nin korunması, iki alan arasında Tab sırası.
   - Açıklama bağlantısı bilerek koparıldığında üç story'nin kırıldığı doğrulandı.

## Sınır durumları ve kısıtlar

- **Hata anında duyurulmuyor:** Hata mesajı `aria-describedby` ile bağlı; ekran okuyucu onu input'a focus gelince okur. Form gönderilince tüm hataları duyurmak (ör. bir özet ve `role="alert"`) form katmanının işi, henüz yok.
- **Yalnızca tek satırlık input:** Textarea, select ve checkbox ileride gerekirse aynı `describedby` mantığıyla eklenecek.
- **Skeleton erişilebilirliği tüketiciye kalmış:** `aria-busy` ve metin alternatifi bileşende değil. Unutulursa ekran okuyucu yükleme durumundan habersiz kalır.
- **EmptyState başlık seviyesi:** Yanlış `headingLevel` verilirse sayfa hiyerarşisi bozulur; bileşen bunu bilemez.

## Mülakat soruları

1. Placeholder neden label yerine geçmez?
   <details><summary>Cevap</summary>Yazmaya başlayınca kaybolur; kullanıcı alanın ne olduğunu unutabilir. Kontrastı genelde düşüktür ve bazı yardımcı teknolojiler onu güvenilir şekilde ad olarak okumaz. WCAG her alan için kalıcı, görünür bir label ister.</details>
2. `aria-describedby` ile `aria-labelledby` farkı nedir?
   <details><summary>Cevap</summary>`labelledby` elemanın adını verir (ne olduğu). `describedby` ek açıklama verir (ipucu, hata) ve addan sonra okunur. İkisi de birden fazla id alabilir; okuma sırası id'lerin sırasıdır.</details>
3. React'te `useId` neden gerekli, `Math.random()` neden olmaz?
   <details><summary>Cevap</summary>`useId` sunucu ve istemcide aynı id'yi üretir; hydration uyuşmazlığı olmaz. Rastgele id her render'da ve sunucu/istemci arasında değişir, bağlantıları bozar.</details>
4. Bir form hatasını ekran okuyucuya nasıl duyurursun?
   <details><summary>Cevap</summary>Alan düzeyinde: `aria-invalid` + `aria-describedby` ile hata metni. Gönderimde: focus'u ilk hatalı alana taşımak veya bir hata özetini `role="alert"` ile duyurmak. Her tuş vuruşunda canlı duyuru yapmak gürültü yaratır.</details>
5. `aria-busy` ne işe yarar?
   <details><summary>Cevap</summary>Bir bölgenin güncellendiğini, değişiklikler bitene kadar okunmaması gerektiğini bildirir. Destek ekran okuyucudan ekran okuyucuya değişir; bu yüzden yanına görünmez bir metin alternatifi eklemek daha güvenli.</details>
6. Skeleton ile spinner ne zaman tercih edilir?
   <details><summary>Cevap</summary>İçeriğin şekli biliniyorsa (liste, kart) skeleton: layout kaymasını önler ve daha hızlı hissettirir. Süre kısaysa veya şekil belirsizse (bir buton aksiyonu) spinner ya da loading durumu yeterli.</details>

## Kendini test et

- TextField'ın `aria-describedby` değerini hangi parçalardan, hangi sırayla oluşturduğunu anlat.
- Yıldızın neden `aria-hidden` olduğunu ve "zorunlu" bilgisinin ekran okuyucuya nasıl ulaştığını açıkla.
- Erişilebilir bir yükleme durumunu Skeleton ile nasıl kurarsın?
