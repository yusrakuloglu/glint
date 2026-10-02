# Radix ve UI mimarisi

## Ne yaptık

- Bileşenlerin temeli olarak Radix Primitives seçildi.
- Uygulamaların `radix-ui`'yi doğrudan import etmesi ESLint ile yasaklandı; Radix'i yalnızca `@glint/ui` kullanacak.
- `@glint/ui` paketinin iskeleti ve `cn()` yardımcısı hazır. Bileşenler henüz yazılmadı (Faz 1 devam ediyor).

## Neden

- **Headless primitive:** Erişilebilirliğin zor kısımları hazır geliyor: focus trap, Esc ile kapanma, focus'un tetikleyiciye dönmesi, menüde ok tuşları ve typeahead, ARIA bağlantıları. Görünüm tamamen bizde.
- **Neden Radix:**
  - Portal'ları `container` prop'u alıyor. Bu, eklentinin Shadow DOM'unda (Faz 6) belirleyici.
  - Ekosistemi en geniş seçenek (shadcn kalıpları, dokümantasyon).
  - Tek, tree-shake edilebilir bir paket.
- **Alternatifler:**
  - Base UI: Radix'in ilk yazarlarından, modern ve aktif geliştiriliyor; ekosistemi daha küçük.
  - React Aria Components: Erişilebilirlikte en titiz seçenek, ama bundle'ı büyük ve Tailwind ile daha fazla sürtünme yaratıyor.
- **Neden doğrudan import yok:**
  - Radix bir uygulama detayı olarak kalsın; bir gün Base UI'a geçmek yalnızca `packages/ui`'ı etkilesin.
  - Erişilebilirlik ve stil kararları tek yerde olsun.
  - Uygulamalarda "yarı stillenmiş" Radix kullanımları birikmesin.

## Nasıl çalışıyor

1. **ESLint kuralı ([eslint/react.js](../../packages/config/eslint/react.js)):**
   - `no-restricted-imports`, `radix-ui` ve `@radix-ui/*` import'larını hata olarak işaretliyor; mesaj "Use components from @glint/ui instead".
   - React preset'ini kullanan her paket (web, ileride eklenti) bu kurala tabi.
   - [packages/ui/eslint.config.js](../../packages/ui/eslint.config.js) kuralı yalnızca kendi içinde kapatıyor.
   - Kural ayrıca [CLAUDE.md](../../CLAUDE.md)'de yazılı.
2. **Paket yapısı ([package.json](../../packages/ui/package.json)):**
   - Barrel dosyası (`index.ts`) yok, alt yol export'ları var: `@glint/ui/cn`, `@glint/ui/styles.css`, ileride `@glint/ui/button` vb.
   - Avantajları: tree-shaking daha temiz, bir bileşeni import etmek diğerlerini yüklemiyor.
3. **`'use client'` sınırı:** Radix bileşenleri hook kullanıyor (Slot bile `useComposedRefs` kullanıyor). Onları saran her dosya `'use client'` ile başlıyor ([button.tsx](../../packages/ui/src/components/button/button.tsx)); Next'in Server Component'leri bu bileşenleri sorunsuz render edebiliyor.
4. **`cn()` ([cn.ts](../../packages/ui/src/lib/cn.ts)):**
   - `clsx` koşullu class'ları birleştiriyor.
   - `tailwind-merge` çakışan utility'lerde sonuncuyu bırakıyor: `cn('px-2', 'px-4')` sonucu `px-4`.
   - Böylece bileşen kendi varsayılan class'larını koyar, tüketici `className` ile güvenle ezer.
5. **PortalContainer ([portal-container.tsx](../../packages/ui/src/lib/portal-container.tsx)):**
   - Dialog, dropdown ve tooltip içeriği varsayılan olarak `document.body`'ye portal'lanıyor.
   - Eklentide arayüz bir shadow root içinde olacak; `body`'ye giden içerik shadow root'un stillerini göremez.
   - `PortalContainerProvider` hedefi context'te tutuyor; `usePortalContainer()` bunu okuyup Radix'in `container` prop'una veriyor. Provider yoksa `undefined` döner ve Radix `body`'yi kullanır.
   - Bir story, tooltip'in shadow root içinde açıldığını ve `body`'ye hiçbir şey sızmadığını test ediyor. Ayrıntılar: [overlay-bilesenleri](overlay-bilesenleri.md).

## Sınır durumları ve kısıtlar

- **Radix'in bakım hızı** son dönemde yavaşladı; uzun vadeli bir risk. İmport kısıtı geçiş maliyetini düşürüyor.
- **ESLint kuralının açıkları:** Yalnızca statik import'ları yakalıyor. Dinamik `import('radix-ui')` veya başka bir paketin Radix'i re-export etmesi kuralı atlar.
- **`tailwind-merge` özel utility'ler:** Tanımadığı değerleri tahmin ederek grupluyor; `cn('bg-surface', 'bg-bg')` → `bg-bg` doğru çalışıyor. Ama ileride özel bir boyut veya gölge utility'si eklenirse yanlış gruba düşebilir; o zaman `extendTailwindMerge` ile tanıtılır.
- **Bileşen dokümanları:** [button](button.md), [form-ve-geri-bildirim-bilesenleri](form-ve-geri-bildirim-bilesenleri.md), [overlay-bilesenleri](overlay-bilesenleri.md). Test altyapısı: [storybook-ve-a11y-testleri](storybook-ve-a11y-testleri.md).

## Mülakat soruları

1. Headless (unstyled) UI kütüphanesi nedir, ne zaman tercih edilir?
   <details><summary>Cevap</summary>Davranış ve erişilebilirliği sağlayıp görünümü tamamen kullanıcıya bırakan kütüphane. Kendi design system'ini kurarken tercih edilir. Hazır stilli kütüphaneleri (MUI vb.) özelleştirmek çoğu zaman onlarla savaşmaya dönüşür.</details>
2. Portal nedir, neden kullanılır?
   <details><summary>Cevap</summary>Bir bileşeni React ağacındaki yerini koruyarak DOM'da başka bir yere (genelde `body`) render etmek. Overlay'ler `overflow: hidden` ve `z-index` stacking context'lerinden kaçabilsin diye kullanılır. Event'ler React ağacına göre kabarcıklanmaya devam eder.</details>
3. Dialog'da focus trap ve focus dönüşü neden gerekli?
   <details><summary>Cevap</summary>Modal açıkken Tab tuşu arka plandaki elemanlara gitmemeli; klavye kullanıcısı görünmeyen içerikte kaybolur. Kapanınca focus, açan elemana dönmeli; yoksa kullanıcı sayfanın başına atılır ve kaldığı yeri kaybeder.</details>
4. `asChild` / Slot deseni ne işe yarar?
   <details><summary>Cevap</summary>Bileşen kendi elemanını render etmek yerine prop'larını ve davranışını tek child'ına aktarır. Örneğin Button'un stilini bir Next `Link`'e vermek, iç içe `<button><a>` gibi geçersiz HTML üretmeden mümkün olur.</details>
5. Üçüncü parti bir kütüphaneyi kendi bileşenlerinle sarmalamanın artısı ve eksisi nedir?
   <details><summary>Cevap</summary>Artısı: tek API, tek stil kaynağı, kütüphane değiştirmenin yalnızca bir pakete dokunması. Eksisi: bakım yükü (her yeni özellik için wrapper'ı güncellemek) ve kütüphanenin tüm esnekliğini dışarıya açmama riski.</details>
6. Shadow DOM, portal'lar için neden sorun çıkarır?
   <details><summary>Cevap</summary>Shadow root stilleri kapsüllüdür: içerideki stiller dışarıya, dışarıdakiler içeriye geçmez. `document.body`'ye portal'lanan içerik shadow root'taki stilleri alamaz ve host sayfanın CSS'inden etkilenir. Çözüm: portal hedefini shadow root içinde tutmak.</details>
7. Barrel dosyası yerine alt yol export'ları neden?
   <details><summary>Cevap</summary>Barrel tüm modülleri tek giriş noktasından export eder. Bazı bundler ve araçlar (özellikle dev modda ve test ortamlarında) her şeyi yükler. Yan etkili modüller tree-shaking'i bozabilir. Alt yollar yalnızca kullanılanı yükler ve `'use client'` sınırlarını netleştirir.</details>

## Kendini test et

- Radix'i neden seçtiğimizi, iki alternatifle karşılaştırarak anlat.
- Web'de birisi `radix-ui` import etmeye çalışırsa ne olur, kural nerede tanımlı, ui'da neden çalışmaz?
- PortalContainer'ın hangi problemi çözeceğini, Shadow DOM'u da kullanarak açıkla.
