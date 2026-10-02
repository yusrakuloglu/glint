# TypeScript ve ESM

## Ne yaptık

Tüm paketler `@glint/config` içindeki ortak bir `base` preset'inden türeyen dört tsconfig preset'i kullanıyor. Repo genelinde tek modül sistemi var: ESM. API ve worker da (NestJS 12) `"type": "module"` ile çalışıyor.

## Neden

- **Ortak preset:** Strict ayarlar her pakette aynı olsun, tek yerden değişsin.
- **Ayrı preset'ler:** Ortamlar farklı. Next ve Vite kodu bundler çözüyor; Nest ise Node'da doğrudan çalışıyor ve decorator metadata'sına ihtiyaç duyuyor.
- **ESM kararının hikâyesi:**
  - [007](../decisions.md): Nest için CommonJS seçildi, çünkü ekosistem orada sorunsuzdu.
  - [008](../decisions.md): NestJS 12 yalnızca ESM yayınlanınca 007'nin gerekçesi geçersiz kaldı. CJS'te kalmak eski ana sürüme (Nest 11) bağlı kalmak demekti; bir gün ESM'e geçiş yine gerekecekti.
  - Bu yüzden tüm repo ESM'e alındı.

## Nasıl çalışıyor

1. **[base.json](../../packages/config/tsconfig/base.json):**
   - `strict`'e ek olarak `noUncheckedIndexedAccess` açık: `arr[0]` tipi `T | undefined` olur.
   - `noImplicitOverride`, `noImplicitReturns` ve `noFallthroughCasesInSwitch` da açık.
2. **[nextjs.json](../../packages/config/tsconfig/nextjs.json):**
   - `moduleResolution: "bundler"`, `jsx: "preserve"` (JSX'i Next dönüştürür).
   - `noEmit` açık, Next eklentisi yüklü.
3. **[react-library.json](../../packages/config/tsconfig/react-library.json):** `@glint/ui` için. Next eklentisi yok, `jsx: "react-jsx"`.
4. **[nest.json](../../packages/config/tsconfig/nest.json):**
   - `module` ve `moduleResolution` `NodeNext`: Node'un gerçek çözümleme kuralları uygulanır.
   - `emitDecoratorMetadata` ve `experimentalDecorators` yalnızca burada açık.
5. **`verbatimModuleSyntax` (hepsinde):**
   - TS, import'ları olduğu gibi bırakır; tip import'ları `import { type X }` diye işaretlenmek zorunda.
   - Böylece derleyici "bu import silinecek mi?" diye tahmin yürütmez.
   - ESLint'teki `consistent-type-imports` kuralı da bunu zorunlu tutuyor.
6. **ESM'in getirdikleri:**
   - api ve worker `package.json`'da `"type": "module"`.
   - Göreli import'lar `.js` uzantılı yazılıyor ([app.module.ts](../../apps/api/src/app.module.ts)). Node ESM uzantı tahmin etmez; TS de `.ts` yazmana izin vermez, çıktıdaki dosya adını yazarsın.
   - [main.ts](../../apps/api/src/main.ts)'de top-level `await` kullanılabiliyor.

## Sınır durumları ve kısıtlar

- `.ts` dosyasında `.js` import etmek başta kafa karıştırıcı. Unutulursa typecheck `NodeNext` sayesinde hata verir.
- Yalnızca CJS yayınlanan bir kütüphane ESM'den `default` import ile gelir; named import'lar her zaman çalışmayabilir.
- Decorator'lar hâlâ eski "experimental" sürüm. Nest, TC39'un standart decorator'larına henüz geçmedi.
- `noUncheckedIndexedAccess` gürültü yaratır: regex eşleşmelerinde ve dizi erişiminde ekstra kontrol gerekir. Bilinçli bir bedel.

## Mülakat soruları

1. ESM ile CommonJS'in temel farkları nelerdir?
   <details><summary>Cevap</summary>ESM statik `import`/`export` kullanır (derleme zamanında analiz edilebilir, tree-shaking mümkün), asenkron yüklenir, top-level await destekler. CJS dinamik `require` kullanır, senkron yüklenir. ESM'de `__dirname` ve `require` yok, yerine `import.meta.url` / `import.meta.dirname` var.</details>
2. `moduleResolution: bundler` ile `NodeNext` farkı nedir?
   <details><summary>Cevap</summary>`bundler`, Vite/webpack gibi araçların gevşek kurallarını taklit eder (uzantısız import serbest). `NodeNext`, Node'un gerçek kurallarını uygular: ESM'de uzantı zorunlu, `package.json` `exports` ve `type` alanları dikkate alınır.</details>
3. `verbatimModuleSyntax` neyi çözer?
   <details><summary>Cevap</summary>Import elision belirsizliğini. Eskiden TS yalnızca tip olarak kullanılan import'ları sessizce silerdi; bu da yan etkili modüllerde veya esbuild/SWC gibi dosya dosya derleyen araçlarda tutarsızlık yaratırdı. Bu ayarla TS, `type` işareti olmayan her import'u korur.</details>
4. "Dual package hazard" nedir?
   <details><summary>Cevap</summary>Bir paketin hem CJS hem ESM sürümü aynı uygulamada yüklenirse iki ayrı modül örneği oluşur. Singleton'lar, `instanceof` kontrolleri ve modül düzeyindeki state bölünür.</details>
5. `emitDecoratorMetadata` neden yalnızca Nest preset'inde açık?
   <details><summary>Cevap</summary>Nest DI, constructor parametre tiplerini `design:paramtypes` metadata'sından okur. Frontend'de decorator yok; bu ayarlar orada gereksiz ve kafa karıştırıcı olurdu.</details>
6. `noUncheckedIndexedAccess` hangi hata sınıfını yakalar?
   <details><summary>Cevap</summary>Dizi veya kayıt erişiminde değerin olmayabileceğini (`undefined`) unutmayı. `strict` bu durumu yakalamaz.</details>

## Kendini test et

- Dört preset'i ve her birinin neden ayrı olduğunu anlat.
- 007'den 008'e geçişi gerekçeleriyle anlat.
- ESM'e geçince koda yansıyan üç somut değişikliği say.
