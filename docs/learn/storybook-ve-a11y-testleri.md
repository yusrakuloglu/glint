# Storybook ve erişilebilirlik testleri

## Ne yaptık

`@glint/ui` için Storybook 10 kurduk. Her story aynı zamanda bir test: Vitest, story'yi gerçek bir Chromium'da (headless) render ediyor, varsa `play` fonksiyonunu çalıştırıyor ve axe ile erişilebilirlik taraması yapıyor. Bir axe ihlali testi kırıyor. İlk story, semantic renk token'larını iki temada gösteren `Foundations/Colors`.

## Neden

- **Tek test runner ([009](../decisions.md)):** `@storybook/addon-vitest` ayrı bir runner değil, bir Vitest eklentisi. `pnpm test` hem unit testleri hem story testlerini Vitest ile çalıştırıyor.
  - Storybook 10.6, Vitest 5'i peer olarak destekliyor.
  - `storybook` paketi `@vitest/expect` ve `@vitest/spy`'ın eski bir sürümünü kendi `storybook/test` modülü için getiriyor; bu yalnızca bir kütüphane kopyası, ikinci bir runner değil.
- **Gerçek tarayıcı:** jsdom'da layout ve computed style yok. Focus yönetimi, portal'lar ve özellikle renk kontrastı ancak gerçek tarayıcıda doğru ölçülüyor.
- **Story = test:** Dokümantasyon ile test aynı kaynaktan geliyor; ayrı bir test dosyası yazıp bakımını yapmaya gerek kalmıyor.
- **Alternatifler:**
  - Storybook test-runner: Jest + Playwright tabanlı; ikinci bir runner getirirdi.
  - Yalnızca Testing Library + jsdom: kontrast ve focus testleri güvenilmez olurdu.

## Nasıl çalışıyor

1. **Storybook ayarı ([.storybook/main.ts](../../packages/ui/.storybook/main.ts)):**
   - Story'ler `src/**/*.stories.tsx`'ten okunuyor.
   - Eklentiler: docs (autodocs), a11y, vitest. Telemetri kapalı.
2. **Preview ([.storybook/preview.tsx](../../packages/ui/.storybook/preview.tsx)):**
   - Toolbar'da bir tema seçici var (System, Light, Dark).
   - `withTheme` decorator'ı, uygulamaların yapacağı gibi `<html>`'e `data-theme` yazıyor.
   - `parameters.a11y.test: 'error'`: axe ihlalleri yalnızca raporlanmıyor, testi kırıyor.
   - Story bazında tema `globals: { theme: 'dark' }` ile sabitlenebiliyor.
3. **Stiller ([.storybook/preview.css](../../packages/ui/.storybook/preview.css)):**
   - Tailwind ve `@glint/ui/styles.css` aynı web'deki gibi import ediliyor.
   - Ek olarak `@source` ile story dosyaları taranıyor (ayrıntı aşağıda).
4. **Vite ([vite.config.ts](../../packages/ui/vite.config.ts)):** React ve Tailwind eklentileri. Storybook bu dosyayı kendiliğinden kullanıyor.
5. **Vitest ([vitest.config.ts](../../packages/ui/vitest.config.ts)):** İki proje var.
   - `unit`: Node ortamında `*.test.ts` dosyaları (`cn`, token okuyucu, kontrast).
   - `storybook`: `storybookTest` eklentisi her story'yi teste çeviriyor. `@vitest/browser-playwright` ile headless Chromium'da çalışıyor.
   - Storybook 10'da ayrı bir setup dosyasına gerek yok; eklenti preview ayarlarını kendisi uyguluyor.
6. **Lint ([eslint.config.js](../../packages/ui/eslint.config.js)):**
   - `eslint-plugin-storybook` story yazım kurallarını denetliyor.
   - Story dosyalarında `vitest` ve `@testing-library/user-event` import'u yasak. `play` fonksiyonları `storybook/test`'teki araçları kullanmalı; adımlar ancak böyle Storybook arayüzünde görünüyor.
7. **CI ([ci.yml](../../.github/workflows/ci.yml)):** Testlerden önce `playwright install --with-deps --only-shell chromium` çalışıyor. Tam Chrome yerine daha küçük olan headless shell iniyor.

## Sınır durumları ve kısıtlar

- **Story'lerdeki class'lar:**
  - `styles/index.css`, uygulamalara yalnızca story'de kullanılan class'lar gitmesin diye story dosyalarını taramıyor (`@source not`).
  - İlk kurulumda bu yüzden Colors story'si stilsiz render ediliyordu ve axe'ın kontrol edeceği renk yoktu; test boşuna geçiyordu.
  - Çözüm: `preview.css`'te story'leri açıkça taramak.
  - **Ders:** Bir testin geçmesi yetmez. Bilerek bir ihlal eklenip testin kırıldığı görülmeli.
- **axe kontrastı her zaman ölçemez:** Saydam katmanlar, gradient veya arka plan görseli varsa sonucu "incomplete" sayıyor ve ihlal bildirmiyor. Token düzeyindeki [kontrast testi](contrast-check.md) bu boşluğu kapatıyor.
- **Klavye senaryoları henüz yok:** axe statik bir tarama; Tab sırası, Esc ve focus dönüşü gibi davranışları ancak `play` fonksiyonları test edebilir. Bunlar bileşenlerle birlikte gelecek.
- **Yerel kurulum:** Story testleri için Chromium'un bir kez indirilmesi gerekiyor (`CLAUDE.md` > İlk kurulum).
- **Yayın:** Storybook'un GitHub Pages'e yayınlanması henüz yok (planlandı).

## Mülakat soruları

1. Component testlerinde jsdom ile gerçek tarayıcı arasındaki fark nedir?
   <details><summary>Cevap</summary>jsdom, DOM API'lerinin JS ile yazılmış bir taklidi: layout, gerçek CSS hesaplaması ve render yok. Hızlıdır ama focus, görünürlük, boyut ve kontrast gibi konularda yanıltabilir. Gerçek tarayıcı daha yavaş ama kullanıcının gördüğünü test eder.</details>
2. axe gibi otomatik araçlar erişilebilirlik sorunlarının ne kadarını yakalar?
   <details><summary>Cevap</summary>Kabaca üçte biri ile yarısı arası. Eksik etiketler, kontrast, geçersiz ARIA gibi kurallarla ifade edilebilen sorunları yakalar. Anlamlı odak sırası, ekran okuyucu deneyimi ve klavye akışı gibi konular manuel veya senaryo testi gerektirir.</details>
3. axe sonucundaki "violation" ile "incomplete" farkı nedir?
   <details><summary>Cevap</summary>Violation, kuralın kesin olarak ihlal edildiğidir. Incomplete, aracın karar veremediği durumdur (ör. arka plan rengi belirlenemedi) ve manuel inceleme ister. Varsayılan olarak testleri kırmaz; bu da sessiz boşluklar yaratabilir.</details>
4. Story'leri test olarak çalıştırmanın avantajı ve riski nedir?
   <details><summary>Cevap</summary>Avantajı: tek kaynak, dokümantasyon ile test her zaman senkron, görsel inceleme kolay. Riski: story'ler gösterim amaçlı yazılırsa uç durumlar test edilmez. Yanlış kurulum (bizdeki gibi stilsiz render) testleri boşuna geçirebilir.</details>
5. `play` fonksiyonu nedir?
   <details><summary>Cevap</summary>Story render edildikten sonra çalışan bir etkileşim senaryosu: tıklama, yazma, tuşa basma ve `expect` ile doğrulama. Storybook arayüzünde adım adım izlenebilir, Vitest'te ise test olarak çalışır.</details>
6. Bir testin gerçekten çalıştığından nasıl emin olursun?
   <details><summary>Cevap</summary>Kasıtlı olarak hata ekleyip testin kırıldığını görürsün (mutation testing'in elle yapılan hali). Kırılmıyorsa test bir şeyi ölçmüyordur. Bu projede hem kontrast hem axe testi böyle doğrulandı.</details>

## Kendini test et

- `pnpm test` çalıştığında bir story'nin teste dönüşüp Chromium'da koşmasına kadar olan adımları anlat.
- Colors story'sinin neden boşuna geçtiğini ve nasıl fark edildiğini anlat.
- axe testi ile token kontrast testinin birbirini nasıl tamamladığını açıkla.
