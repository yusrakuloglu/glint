# Overlay bileşenleri

## Ne yaptık

Sayfanın üstünde açılan dört bileşen yazdık: `Tooltip`, `DropdownMenu`, `Dialog` ve `Toast`. Hepsi Radix üzerine kurulu. İlk üçü içeriğini `PortalContainerProvider`'ın gösterdiği hedefe portal'lıyor. Toast imperative bir `toast()` fonksiyonuyla tetikleniyor.

## Neden

- **Overlay erişilebilirliğin en zor kısmı:** Focus nereye gider, nerede kilitlenir, kapanınca nereye döner, Escape ne yapar, ekran okuyucu ne duyar? Radix bu davranışları WAI-ARIA kalıplarına göre hazır veriyor ([012](../decisions.md)).
- **PortalContainer:** Eklentide arayüz shadow root içinde olacak. `body`'ye portal'lanan bir menü shadow root'un stillerini alamaz (bkz. [radix-ve-ui-mimarisi](radix-ve-ui-mimarisi.md)).
- **Imperative toast:** Toast'lar genelde bileşen dışında doğar (bir mutation'ın `onError`'unda, optimistic update'i geri alırken). Hook gerektiren bir API bunu zorlaştırırdı.
- **sonner yerine Radix Toast:** sonner stilini `document.head`'e enjekte ediyor; Shadow DOM'da çalışmaz. Radix Toast zaten pakette.

## Nasıl çalışıyor

1. **Portal hedefi ([portal-container.tsx](../../packages/ui/src/lib/portal-container.tsx)):** `usePortalContainer()` context'teki hedefi döndürüyor; provider yoksa `undefined` döner ve Radix `body`'yi kullanır.
2. **Tooltip ([tooltip.tsx](../../packages/ui/src/components/tooltip/tooltip.tsx)):**
   - Hover'da gecikmeyle, klavye focus'unda hemen açılıyor. Escape kapatıyor, focus yerinde kalıyor.
   - Açıkken tetikleyiciye `aria-describedby` ekleniyor.
   - Her tooltip kendi `Provider`'ını içeriyor, uygulama düzeyinde kurulum gerekmiyor.
   - Bir story tooltip'in shadow root içinde açıldığını ve `body`'ye sızmadığını test ediyor. `container` bağlantısı bilerek koparılınca test kırılıyor.
3. **DropdownMenu ([dropdown-menu.tsx](../../packages/ui/src/components/dropdown-menu/dropdown-menu.tsx)):**
   - Radix'in compound API'si korunuyor: Trigger, Content, Item, CheckboxItem, Label, Separator, Shortcut.
   - Klavye: Enter/Space/↓ açar ve ilk öğeye focus verir, oklar gezinir (disabled öğeler atlanır), harf yazınca eşleşen öğeye atlar (typeahead), Escape kapatır ve focus tetikleyiciye döner.
   - `variant="danger"` silme gibi aksiyonlar için. `Shortcut` yalnızca görsel bir ipucu (`aria-hidden`).
4. **Dialog ([dialog.tsx](../../packages/ui/src/components/dialog/dialog.tsx)):**
   - `title` tip düzeyinde zorunlu ve dialog'un erişilebilir adı oluyor. `description` verilirse erişilebilir açıklama oluyor; verilmezse `aria-describedby` bilinçli olarak kaldırılıyor.
   - Açılınca focus içeri giriyor ve kilitleniyor (focus trap); Escape kapatıyor; focus açan butona dönüyor.
   - Kapat butonu DOM'da en sonda (görsel olarak sağ üstte). Böylece ilk focus "Kapat"a değil içeriğe (ör. ilk input'a) düşüyor.
   - Overlay rengi iki temada aynı olduğu için `theme.css`'te tek bir `--color-overlay` olarak tanımlı.
5. **Toast:**
   - [toast-store.ts](../../packages/ui/src/components/toast/toast-store.ts): Framework'ten bağımsız küçük bir store. `toast()` ekliyor, `dismissToast()` kapatıyor, `subscribe` ve `getToasts` ile okunuyor. Her değişiklikte yeni dizi döndürüyor; `useSyncExternalStore` bunu bekliyor. Node'da unit testleri var.
   - [toaster.tsx](../../packages/ui/src/components/toast/toaster.tsx): `useSyncExternalStore` ile store'u okuyor. Sunucu snapshot'ı boş dizi, böylece SSR'da hydration uyuşmazlığı olmuyor.
   - `danger` toast'lar `foreground` (assertive, araya girer), diğerleri `background` (polite, sırasını bekler) olarak duyuruluyor.
   - Aksiyon (ör. "Geri al") için `altText` zorunlu: ekran okuyucu kullanıcısına aynı işi toast olmadan nasıl yapacağını söylüyor.
   - F8 toast bölgesine focus taşıyor. Hover veya focus varken otomatik kapanma duraklıyor.
   - Toast'lar `<Toaster>` nereye konduysa orada çıkıyor; eklentide shadow root'un içine konacak.

## Sınır durumları ve kısıtlar

- **axe ve açık modal'lar:** Radix modal menü ve dialog'da arka planı `aria-hidden` yapıp focus'u kilitliyor. axe, artık ulaşılamayan tetikleyiciyi `aria-hidden-focus` ihlali sanıyor. Kural yalnızca açık biten story'lerde kapatıldı ([015](../decisions.md)).
- **Tooltip dokunmatikte açılmıyor:** Bu bilinçli; tooltip yalnızca ek bilgi taşımalı, temel bilgi taşımamalı.
- **Ayrı provider'lar:** Her tooltip kendi provider'ını kullandığı için "bir tooltip açıkken diğerine geçince gecikmesiz aç" davranışı yok.
- **Toast store modül düzeyinde bir singleton:** Aynı sayfada iki bağımsız Toaster olamaz. Testlerde her story başında `dismissToast()` ile temizleniyor.
- **Overlay animasyonları yok:** Açılış ve kapanış geçişleri sonra eklenebilir (`motion-safe` ile).
- **Metinler İngilizce sabit:** "Close", "Dismiss" ve "Notifications" prop ile değiştirilebiliyor; i18n Faz 8'de.
- **user-event'in sınırları:** Shadow DOM içinde `tab()` çalışmıyor; F8 için `code` gönderen `[F8]` sözdizimi gerekiyor.

## Mülakat soruları

1. Modal bir dialog'un klavye davranışı nasıl olmalı?
   <details><summary>Cevap</summary>Açılınca focus dialog içine (ilk anlamlı öğeye) girer, Tab ve Shift+Tab dialog içinde döner, Escape kapatır, kapanınca focus açan elemana döner. Arka plan etkileşime ve ekran okuyucuya kapalıdır (`aria-modal`, `inert` veya `aria-hidden`).</details>
2. Tooltip ile dialog veya popover arasındaki fark nedir?
   <details><summary>Cevap</summary>Tooltip etkileşimsiz, kısa ve ek bir açıklamadır; focus almaz, içinde buton olmaz, tetikleyiciyi `aria-describedby` ile tanımlar. Etkileşimli içerik gerekiyorsa popover veya dialog kullanılır.</details>
3. Menü düğmesinde `aria-expanded` ve `aria-haspopup` neden önemli?
   <details><summary>Cevap</summary>Ekran okuyucu kullanıcısı düğmenin bir menü açtığını ve şu an açık mı kapalı mı olduğunu bu attribute'lardan öğrenir. Görsel ok ikonu bu bilgiyi yalnızca gören kullanıcıya verir.</details>
4. `aria-live` polite ile assertive farkı nedir, toast'ta hangisi?
   <details><summary>Cevap</summary>Polite, kullanıcının o anki okumasını bitirmesini bekler; assertive araya girer. Assertive yalnızca acil durumlar (hata) için kullanılmalı. Burada hata toast'ları assertive, diğerleri polite.</details>
5. `useSyncExternalStore` neden var, ne çözüyor?
   <details><summary>Cevap</summary>React dışındaki bir store'a güvenle abone olmak için. Concurrent rendering sırasında aynı render'ın farklı parçalarının farklı store değerleri görmesini (tearing) önler. SSR için ayrı bir sunucu snapshot'ı alır.</details>
6. Neden bazı bileşenlerde focus'u bilerek "Kapat" butonuna vermiyoruz?
   <details><summary>Cevap</summary>İlk focus, kullanıcının büyük ihtimalle yapacağı şeye düşmeli (ör. formun ilk alanı). Kapat'a düşen focus bir Enter'la dialog'un yanlışlıkla kapanmasına yol açabilir ve ekran okuyucu ilk olarak "Kapat" duyurur.</details>
7. Toast'ta "Geri al" aksiyonu erişilebilirlik açısından neden risklidir?
   <details><summary>Cevap</summary>Toast kendiliğinden kaybolur; klavye veya ekran okuyucu kullanıcısı ona zamanında ulaşamayabilir. Bu yüzden Radix `altText` ister, süre focus ve hover'da durur ve F8 kısayolu vardır. Kritik geri alma işlemleri başka bir yoldan da (ör. çöp kutusu) yapılabilmeli.</details>

## Kendini test et

- Dialog açılıp kapanırken focus'un izlediği yolu adım adım anlat.
- `PortalContainerProvider` olmadan eklentide bir dropdown açılırsa ne olur, provider bunu nasıl çözer?
- `toast()` çağrısından ekranda toast görünmesine kadar olan akışı (store, subscribe, render) anlat.
- axe istisnasını neden yalnızca açık biten story'lerde yaptığımızı ve diğer kuralların hâlâ çalıştığını nasıl doğruladığımızı açıkla.
