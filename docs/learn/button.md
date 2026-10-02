# Button

## Ne yaptık

`@glint/ui`'ın ilk bileşeni olarak `Button` ve `IconButton`'ı yazdık. Button dört varyant (primary, secondary, ghost, danger) ve üç boyut destekliyor; bir link'i buton gibi stillendirebiliyor (`asChild`) ve loading durumunda focus'u kaybetmiyor. IconButton, erişilebilir adı (`aria-label`) tip düzeyinde zorunlu tutuyor.

## Neden

- **Varyantlar için cva:** Varyant/boyut kombinasyonlarını tipli bir API'ye çeviriyor; `VariantProps` ile prop tipleri otomatik çıkıyor. Alternatif olarak `tailwind-variants` slot desteği sunuyor ama bu ölçekte cva yeterli ve daha yaygın.
- **`asChild` (Radix Slot):** "Buton görünümlü link" çok yaygın. `<button><a>` geçersiz HTML; `<a className={buttonClasses}>` ise stil mantığını dağıtır. Slot, stili ve prop'ları tek child'a aktarıyor.
- **Ayrı IconButton:** Tek bileşende "children metin değilse `aria-label` zorunlu" kuralını tip düzeyinde ifade etmek karmaşık. Ayrı bileşen bunu basitçe zorunlu kılıyor.

## Nasıl çalışıyor

1. **Stiller ([button.tsx](../../packages/ui/src/components/button/button.tsx) `buttonVariants`):**
   - Ortak taban: flex hizalama, focus halkası (`focus-visible:outline-ring`), `disabled` ve `aria-disabled` stilleri, SVG boyutları.
   - Varyantlar yalnızca semantic token'ları kullanıyor (`bg-primary`, `hover:bg-surface-hover` ...); renkler temayla kendiliğinden değişiyor.
   - `motion-safe:transition-colors`: hareket azaltma tercihine uyuluyor.
   - Sonuç `cn()` ile birleşiyor; tüketicinin `className`'i çakışan class'ları eziyor.
2. **Varsayılan `type="button"`:** Native `<button>`'ın varsayılanı `submit`; bir form içindeki her buton sessizce formu gönderir. Bunu önlemek için varsayılan değiştirildi; `type="submit"` açıkça verilmeli.
3. **Loading:**
   - `disabled` yerine `aria-disabled="true"` ve `aria-busy="true"` kullanılıyor. `disabled` bir buton focus alamaz; kullanıcı "Kaydet"e bastığında focus `body`'ye düşer ve klavye kullanıcısı yerini kaybeder.
   - Tıklamalar `handleClick` içinde yok sayılıyor; spinner `aria-hidden`.
   - IconButton'da spinner ikonun yerine geçiyor; ad (`aria-label`) aynı kalıyor.
4. **`asChild`:** `Slot.Root` class'ları ve prop'ları child'a veriyor. Bu modda spinner ve `type` uygulanmıyor, çünkü Slot tek bir child bekliyor ve child bir buton olmayabilir.
5. **`'use client'`:** Slot bir hook (`useComposedRefs`) kullanıyor; dosya client bileşeni olarak işaretli. Next'in Server Component'leri Button'ı yine render edebiliyor.
6. **Testler ([button.stories.tsx](../../packages/ui/src/components/button/button.stories.tsx)):**
   - Her story axe ile taranıyor; varyantlar ayrıca dark temada render ediliyor.
   - `play` senaryoları: Tab ile focus, Enter ve Space ile tetikleme, form içinde submit olmaması, loading'de focus'un kalıp tıklamanın yok sayılması, disabled'ın Tab sırasından çıkması, `asChild` ile gerçek bir link üretilmesi.
   - Varsayılan `type` ve loading kontrolü bilerek bozulduğunda ilgili testlerin kırıldığı doğrulandı.

## Sınır durumları ve kısıtlar

- **Disabled kontrastı:** `disabled:opacity-50` kontrastı düşürüyor. WCAG devre dışı kontrolleri kontrast şartından muaf tutuyor, axe de onları atlıyor; ama düşük görüşlü kullanıcılar için okunabilirlik zayıf.
- **`asChild` + loading desteklenmiyor:** Link içinde spinner gösterilmiyor.
- **IconButton'ın görünür etiketi yok:** Gören kullanıcılar ikonun anlamını tahmin etmek zorunda. Tooltip bileşeni gelince ikon butonlarla birlikte kullanılacak.
- **Ekran okuyucu desteği değişken:** Bazı ekran okuyucular `aria-busy`'yi butonlarda duyurmuyor. İşlem sonucu ayrıca (ör. toast ile) bildirilmeli.

## Mülakat soruları

1. `<button>`'ın varsayılan `type`'ı nedir, neden sorun yaratır?
   <details><summary>Cevap</summary>`submit`. Form içindeki her buton (ör. "İptal" veya bir ikon butonu) tıklanınca formu gönderir. Design system butonlarında varsayılanı `button` yapmak bu sınıf hatayı ortadan kaldırır.</details>
2. `disabled` ile `aria-disabled` farkı nedir?
   <details><summary>Cevap</summary>`disabled` elemanı Tab sırasından çıkarır, tıklamaları tarayıcı engeller ve ekran okuyucular çoğu zaman onu atlar. `aria-disabled` yalnızca durumu duyurur; eleman focus alabilir ve tıklamayı engellemek koda kalır. Loading gibi geçici durumlarda focus'u korumak için `aria-disabled` tercih edilir.</details>
3. `asChild` / Slot deseni nasıl çalışır?
   <details><summary>Cevap</summary>Bileşen kendi elemanını render etmek yerine prop'larını, class'larını ve ref'ini tek child'ına birleştirerek aktarır (cloneElement + ref birleştirme). Böylece davranış ve stil, farklı bir eleman (link, router link) üzerinde kullanılabilir.</details>
4. Bir ikon butonunun erişilebilir adı nereden gelir?
   <details><summary>Cevap</summary>Metin içeriği yoksa `aria-label` veya `aria-labelledby`'den. İkon SVG'si `aria-hidden` olmalı; yoksa ekran okuyucu anlamsız bir grafik okuyabilir. Ad tip düzeyinde zorunlu tutulunca eksik ad derleme zamanında yakalanır.</details>
5. `cn()` neden yalnızca `clsx` değil, `tailwind-merge` da içeriyor?
   <details><summary>Cevap</summary>`clsx` yalnızca birleştirir; `px-4` ve `px-2` ikisi birden kalır ve hangisinin kazanacağını CSS'teki sıra belirler, class sırası değil. `tailwind-merge` çakışan utility'lerde sonuncuyu bırakır; tüketicinin `className`'i öngörülebilir şekilde ezer.</details>
6. `focus-visible` ile `focus` farkı nedir?
   <details><summary>Cevap</summary>`focus` her odaklanmada (fare tıklaması dahil) eşleşir. `focus-visible` tarayıcının odak göstergesinin gerekli olduğuna karar verdiği durumlarda eşleşir: genelde klavye ile gezinme. Böylece fare kullanıcıları her tıklamada halka görmez, klavye kullanıcıları ise her zaman görür.</details>

## Kendini test et

- Loading durumunda neden `disabled` kullanmadığımızı, focus akışı üzerinden anlat.
- `asChild` ile bir link render edildiğinde hangi prop'ların nereye gittiğini anlat.
- Button story'lerindeki klavye senaryolarını ve her birinin hangi hatayı yakaladığını say.
