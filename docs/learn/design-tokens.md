# Design token'ları

## Ne yaptık

`@glint/ui` içinde CSS değişkenleriyle üç katmanlı bir token sistemi kurduk. Katmanlar: OKLCH primitive'leri, light/dark'a göre değişen semantic token'lar ve bunları Tailwind utility'lerine bağlayan eşleme. Tema varsayılan olarak sistem tercihini izliyor; `data-theme` bunu eziyor.

## Neden

- **Tek kaynak:** Web ve eklenti aynı renkleri kullanacak. Değerler CSS değişkeni olduğu için tema runtime'da, yeniden derleme olmadan değişiyor.
- **Katmanlama:** Bileşenler "gray-900" değil "fg" der. Tema değişince yalnızca semantic katman değişir; bileşenlere dokunulmaz.
- **OKLCH:** Algısal olarak düzgün bir renk uzayı. Aynı `L` (lightness) değeri farklı tonlarda gözle de aynı parlaklıkta görünür. HSL'de sarı ile mavinin "aynı lightness"ı bambaşka görünür. Kontrastı tahmin etmek bu yüzden kolaylaşıyor.
- **Eski yöntem:** Tailwind 3 tarzı JS preset kullanılıyordu. Tailwind 4'ün CSS-first `@theme` yaklaşımına geçtik; preset kaldırıldı.

## Nasıl çalışıyor

1. **Primitive ([tokens.css](../../packages/ui/src/styles/tokens.css)):** `--gray-50…950`, `--brand-*` ve durum renkleri. Bileşenler bunları doğrudan kullanmaz.
2. **Semantic (aynı dosya):**
   - Örnek: `--bg: light-dark(var(--gray-50), var(--gray-950))`.
   - `light-dark()` iki değerden birini elemanın `color-scheme`'ine göre seçer. Böylece her token iki tema için tek satır.
   - Token grupları: yüzey (`bg`, `surface`, `surface-raised`), metin (`fg`, `fg-muted`), çizgi (`border`, `border-input`, `ring`), aksiyon (`primary*`, `danger*`) ve durum (`success`, `warning`).
3. **Tema seçimi:**
   - Kökte `color-scheme: light dark` var, yani tarayıcı sistem tercihini izler.
   - `[data-theme='light'|'dark']` bunu tek bir değere sabitler.
   - Seçiciler `:root, :host`, aynı token'lar eklentinin Shadow DOM'unda da çalışsın diye.
4. **Tailwind eşlemesi ([theme.css](../../packages/ui/src/styles/theme.css)):**
   - `@theme inline` içinde `--color-bg: var(--bg)` gibi satırlar `bg-bg`, `text-fg-muted` gibi utility'ler üretir.
   - `inline` sayesinde utility değeri kopyalamaz, değişkene referans verir; tema runtime'da değişebilir.
   - `--color-*: initial` Tailwind'in varsayılan paletini kapatır. `bg-red-500` gibi token dışı renkler artık yazılamaz.
5. **`dark:` variant'ı:** `data-theme` ile sistem tercihine aynı mantıkla bakar. Semantic token'lar zaten temayla değiştiği için nadiren gerekir.
6. **Giriş noktası ([index.css](../../packages/ui/src/styles/index.css)):**
   - Token'ları ve temayı import eder.
   - `@source '..'` ile ui kaynaklarını class için tarar, böylece tüketicinin ui'ın yolunu bilmesi gerekmez.
   - Web tarafı yalnızca `@import 'tailwindcss'` ve `@import '@glint/ui/styles.css'` yazar.
7. **Kontrast kontrolü:**
   - [read-tokens.ts](../../packages/ui/src/styles/read-tokens.ts) `tokens.css`'i okuyup her token'ı iki tema için OKLCH değerine çözüyor.
   - [contrast.test.ts](../../packages/ui/src/styles/contrast.test.ts) renk çiftlerini iki temada WCAG eşikleriyle denetliyor: metin için 4.5:1, input kenarı ve focus ring için 3:1.
   - Dönüşüm ve hesap ayrıntıları: [contrast-check](contrast-check.md).

## Sınır durumları ve kısıtlar

- **İç içe tema yok:**
  - Tailwind'in Lightning CSS'i `light-dark()`'ı eski tarayıcılar için `--lightningcss-light/dark` değişkenlerine çeviriyor.
  - Bu değişkenler token'ların tanımlandığı yerde (kökte) çözülüyor.
  - Sonuç: `data-theme` sayfanın ortasındaki bir elemana verilirse etkisi olmaz. Tema yalnızca kökte veya shadow host'ta değişir.
- **Shadow DOM riskleri (Faz 6):**
  - `:host` seçicisi eklendi.
  - Tailwind 4'ün bazı utility'leri `@property` kullanıyor ve `@property` shadow root içinde tanımlanınca çalışmıyor.
  - `rem` birimi host sayfanın kök font boyutuna bağlı; eklenti arayüzü sayfadan sayfaya farklı boyutta görünebilir.
- **FOUC:** Web'de tema seçici ve sayfa yüklenmeden temayı uygulayan script henüz yok (Faz 4).

## Mülakat soruları

1. Primitive ve semantic token farkı nedir, neden ikisi birden var?
   <details><summary>Cevap</summary>Primitive ham değerdir (bir renk tonu). Semantic, değerin rolünü anlatır (metin, arka plan). Bileşenler rollerle konuşur. Tema veya marka değişince yalnızca rol → değer eşlemesi değişir, bileşen kodu değişmez.</details>
2. CSS değişkenleri ile Sass değişkenleri arasındaki temel fark nedir?
   <details><summary>Cevap</summary>Sass değişkenleri derleme zamanında sabit değerlere dönüşür. CSS değişkenleri runtime'da yaşar, cascade ile miras alınır ve JS ya da seçicilerle değiştirilebilir. Bu yüzden runtime tema değişimi yalnızca CSS değişkenleriyle mümkündür.</details>
3. OKLCH'yi HSL'e neden tercih ettik?
   <details><summary>Cevap</summary>HSL'in lightness değeri algısal değil; aynı L'deki iki ton gözle farklı parlaklıkta görünür. OKLCH algısal olarak düzgündür: L değeri gerçek parlaklığa yakındır. Bu da tutarlı paletler kurmayı ve kontrastı tahmin etmeyi kolaylaştırır. P3 gibi geniş gamut renkleri de ifade edebilir.</details>
4. `light-dark()` ve `color-scheme` birlikte nasıl çalışır?
   <details><summary>Cevap</summary>`color-scheme`, elemanın hangi şemaları desteklediğini veya hangisinde olduğunu söyler (form kontrolleri ve scrollbar'lar da buna uyar). `light-dark(a, b)`, kullanılan şema light ise a'yı, dark ise b'yi döndürür. `color-scheme: light dark` olduğunda sistem tercihi kullanılır.</details>
5. WCAG 1.4.3 ile 1.4.11 farkı nedir?
   <details><summary>Cevap</summary>1.4.3 metin kontrastıdır: normal metin için 4.5:1, büyük metin için 3:1. 1.4.11 metin olmayan öğeler içindir (input kenarları, focus göstergesi, ikonlar): 3:1. Dekoratif kenarlıklar kapsam dışıdır; bu yüzden `border` ile `border-input` ayrı token.</details>
6. FOUC nedir, tema için nasıl önlenir?
   <details><summary>Cevap</summary>Sayfa önce yanlış stille görünüp sonra düzelir (ör. light açılıp dark'a geçmesi). Tema `<head>` içindeki küçük, senkron bir inline script ile render'dan önce kök elemana uygulanarak önlenir.</details>
7. Tailwind'de `@theme` ile `@theme inline` farkı nedir?
   <details><summary>Cevap</summary>`@theme` değeri utility'ye kopyalar ve değişkeni de tanımlar. `inline` ise utility'nin doğrudan `var(--x)` referansı kullanmasını sağlar. Değer başka bir değişkene bağlıysa (bizim semantic token'larımız gibi) `inline` gerekir; yoksa referans yanlış kapsamda çözülebilir.</details>

## Kendini test et

- Bir rengin `--gray-950`'den `bg-bg` utility'sine kadar geçtiği üç katmanı anlat.
- Kullanıcı OS'ta dark seçmiş ama `data-theme="light"` verilmişse hangi kuralın kazandığını ve nedenini açıkla.
- Lightning CSS fallback'i yüzünden iç içe temanın neden çalışmadığını anlat.
- Shadow DOM'daki üç riski ve her birinin olası çözümünü say.
