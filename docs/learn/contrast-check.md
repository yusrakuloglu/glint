# Kontrast kontrolü

## Ne yaptık

Design token'larının renk kontrastını otomatik test eden bir kontrol yazdık. Test `tokens.css`'i okuyor, OKLCH renklerini sRGB'ye çeviriyor ve 32 renk çiftini her iki temada WCAG 2.2 AA eşikleriyle karşılaştırıyor. Bir token değişip kontrast düşerse `pnpm test` kırılıyor.

## Neden

- **axe tek başına yetmiyor:** axe yalnızca o an render edilmiş temayı ve sayfadaki gerçek elemanları denetliyor. Henüz hiçbir bileşende kullanılmayan bir çift (ör. dark `danger-fg/danger`) gözden kaçar.
- **Token düzeyinde test:** Bileşen yazılmadan önce paletin kendisi doğrulanmış oluyor; hata kaynağında yakalanıyor.
- **Ek bağımlılık yok:** `culori` veya `colorjs.io` dönüşümü hazır sunuyor. Ama ihtiyaç yalnızca iki fonksiyon (~40 satır) ve bu matematik mülakatta anlatılabilir olmalı.
- **Ölçüt olarak WCAG 2.x:** APCA (WCAG 3 taslağı) algısal olarak daha doğru, ama henüz standart değil ve axe de WCAG 2.x kullanıyor. İkisi tutarlı kalsın diye WCAG 2.x seçildi.

## Nasıl çalışıyor

1. **Token'ları okuma ([read-tokens.ts](../../packages/ui/src/styles/read-tokens.ts)):**
   - `parseTokens`, `:root, :host` bloğundaki `--ad: değer;` satırlarını topluyor.
   - `oklch(...)` değerleri primitive olarak kaydediliyor.
   - `light-dark(a, b)` değerleri iki temaya ayrılıyor; `var(--x)` primitive'e, `white`/`black` sabit değere çözülüyor.
   - Bilinmeyen bir referans veya desteklenmeyen bir format hata fırlatıyor; test sessizce yanlış renkle geçmiyor.
2. **OKLCH → sRGB ([color.ts](../../packages/ui/src/styles/color.ts) `oklchToSrgb`):**
   - OKLCH polar koordinattır. Hue açısından `a = C·cos(h)`, `b = C·sin(h)` hesaplanıyor ve OKLab elde ediliyor.
   - OKLab → LMS: Bir matris çarpımıyla göz konilerinin (uzun, orta, kısa dalga) tepkisine geçiliyor, sonra küpü alınarak OKLab'ın küp kökü geri alınıyor.
   - LMS → lineer sRGB: İkinci bir matris çarpımı.
   - Lineer → gamma-encoded sRGB (`encode`): Ekranların beklediği eğri; küçük değerlerde doğrusal, büyüklerde `1.055·x^(1/2.4) − 0.055`.
   - Gamut dışı kanallar `[0, 1]` aralığına kırpılıyor.
3. **Kontrast ([color.ts](../../packages/ui/src/styles/color.ts) `contrastRatio`):**
   - `relativeLuminance`: Her kanal `decode` ile tekrar lineerleştiriliyor, sonra gözün hassasiyetine göre ağırlıklandırılıyor: `0.2126·R + 0.7152·G + 0.0722·B` (göz en çok yeşile duyarlı).
   - Oran: `(açık + 0.05) / (koyu + 0.05)`. 0.05 ortam ışığının yansımasını temsil ediyor ve sıfıra bölmeyi önlüyor. Sonuç 1 ile 21 arasında.
4. **Test ([contrast.test.ts](../../packages/ui/src/styles/contrast.test.ts)):**
   - Çift listesi: her metin token'ı her yüzey üzerinde 4.5:1 (WCAG 1.4.3); aksiyon renkleri kendi metinleriyle 4.5:1; `border-input` ve `ring` her yüzeyde 3:1 (WCAG 1.4.11).
   - Önceden çiftler tek tek yazılıyordu. Yeni `surface-hover` eklenince axe, light temada `danger` (4.33) ve `success` (4.49) metninin bu yüzeyde eşiğin altında kaldığını yakaladı; liste bu yüzden metin × yüzey kombinasyonuna çevrildi.
   - `describe.each` iki temada da aynı listeyi çalıştırıyor.
5. **Dönüşümün doğruluğu ([color.test.ts](../../packages/ui/src/styles/color.test.ts)):**
   - Bilinen referanslarla karşılaştırma: CSS Color 4'teki saf kırmızı, Tailwind'in yayınladığı gray-50 ve sky-700. Kanal başına en fazla 1/255 sapmaya izin veriliyor.
   - Kontrast için WebAIM değerleriyle karşılaştırma: `#767676` beyaz üzerinde 4.54, eşiği geçen en açık gri.
6. **Mevcut durum:** Light temada en sıkı çiftler `warning/surface-hover` (4.59) ve `ring/surface-hover` (3.65). Dark temada en sıkı çift `border-input/surface-raised` (3.04), yani eşiğin hemen üstünde.

## Sınır durumları ve kısıtlar

- **Kırpma ile gamut mapping farkı:** Tarayıcılar gamut dışı rengi chroma'yı azaltarak sRGB'ye sığdırıyor; biz kırpıyoruz. Gamut dışı renklerde hesaplanan oran ile ekrandaki oran biraz farklı olabilir. Paletteki doygun kırmızılar (ör. `red-600`) bu sınıra yakın.
- **Saydamlık yok:** Yarı saydam renkler (`bg-primary/50` gibi) arka planla karıştığı için bu testte değerlendirilmiyor.
- **Liste elle güncelleniyor:** Yeni bir yüzey veya metin token'ı eklenince `surfaces` / `textTokens` dizilerine eklenmeli; test yeni token'ı kendisi bulmuyor.
- **Büyük metin eşiği yok:** Büyük metin için WCAG 3:1 yeterli sayıyor; biz her metin çiftine 4.5:1 uyguluyoruz (bilinçli olarak sıkı).
- **Parser kısıtlı:** Yalnızca birimsiz `oklch(L C H)` formatını okuyor. `50%` veya hex yazılırsa hata veriyor.

## Mülakat soruları

1. WCAG kontrast oranı nasıl hesaplanır?
   <details><summary>Cevap</summary>Her rengin relative luminance'ı hesaplanır (kanallar lineerleştirilir, 0.2126/0.7152/0.0722 ile ağırlıklandırılır). Oran = (açık + 0.05) / (koyu + 0.05). Normal metinde AA için 4.5:1, büyük metin ve metin dışı öğeler için 3:1 gerekir.</details>
2. Gamma encoding nedir, luminance hesaplamadan önce neden geri alınır?
   <details><summary>Cevap</summary>sRGB değerleri, gözün karanlık tonlara duyarlılığına göre sıkıştırılmıştır (doğrusal değildir). Işık miktarı toplanacaksa (luminance) önce lineer ışık değerine dönmek gerekir; yoksa ağırlıklı toplam fiziksel olarak anlamsız olur.</details>
3. Luminance formülünde yeşilin ağırlığı neden en yüksek?
   <details><summary>Cevap</summary>İnsan gözü yeşil dalga boylarına en duyarlıdır. Aynı enerjideki yeşil ışık, kırmızı veya maviden çok daha parlak algılanır.</details>
4. OKLCH'den sRGB'ye dönüşümün adımları nelerdir?
   <details><summary>Cevap</summary>OKLCH (polar) → OKLab (kartezyen: a, b) → LMS (matris çarpımı ve küp alma) → lineer sRGB (ikinci matris) → gamma-encoded sRGB (transfer fonksiyonu). Gerekirse arada gamut mapping yapılır.</details>
5. Gamut dışı renk nedir, nasıl ele alınır?
   <details><summary>Cevap</summary>Hedef renk uzayında (burada sRGB) ifade edilemeyen renk; bir kanal 0'ın altına veya 1'in üstüne çıkar. En basit yöntem kırpmaktır, ama ton kayabilir. CSS Color 4, ton ve lightness'ı koruyup chroma'yı azaltmayı önerir.</details>
6. axe varken neden ayrı bir token kontrast testi yazdık?
   <details><summary>Cevap</summary>axe yalnızca render edilen DOM'u ve aktif temayı görür. Token testi bileşenden bağımsızdır, her iki temayı da kapsar ve henüz kullanılmayan çiftleri de denetler. İkisi birbirini tamamlar.</details>
7. WCAG 2.x kontrast formülünün bilinen zayıflıkları neler, APCA ne öneriyor?
   <details><summary>Cevap</summary>WCAG 2.x koyu temalarda kontrastı olduğundan iyi gösterebiliyor; yazı boyutu ve kalınlığını yalnızca kaba eşiklerle hesaba katıyor. APCA, metin ve arka plan sırasını (açık üstüne koyu mu, koyu üstüne açık mı) ve font ağırlığını dikkate alan algısal bir model öneriyor. Henüz standart değil.</details>

## Kendini test et

- Bir token'ın `tokens.css`'teki satırından test sonucuna kadar geçtiği adımları anlat.
- OKLab → LMS → lineer sRGB → gamma zincirinde her adımın neden gerektiğini açıkla.
- Kontrast formülündeki 0.05'in anlamını ve oranın neden 1–21 aralığında kaldığını anlat.
- Kırpmanın sonucu hangi durumda yanıltabilir, bunu nasıl fark ederiz?
