# Karar kayıtları

Her kayıt: tarih, karar, neden, alternatifler. Kısa tut.

## 001 – pnpm + Turborepo monorepo

Web, API, worker ve eklenti tipleri ve UI bileşenlerini paylaşıyor. pnpm hızlı, workspace desteği güçlü ve bağımlılık script'lerini varsayılan olarak çalıştırmıyor.

## 002 – Redis yerine pg-boss

Kuyruk Postgres üzerinde çalışır; ücretsiz katmanda ayrı Redis servisine gerek kalmaz.

## 003 – Sayfa içeriğini eklenti gönderir

Sunucuda scraping yok. Sunucu yükü düşer, giriş gerektiren sayfalar da kaydedilebilir.

## 004 – Yerel embedding

multilingual-e5-small, transformers.js ile worker'da çalışır. API maliyeti yok, Türkçe desteği iyi.

## 005 – Özetler URL bazında paylaşılır

Aynı URL'nin özeti bir kez üretilir, tüm kullanıcılar kullanır. AI maliyeti ve gecikme düşer.

## 006 – ESLint 9'da kalınır (2026-10-01)

typescript-eslint 8 ve eslint-plugin-jsx-a11y henüz ESLint 10'u peer olarak desteklemiyor; `@eslint/js` de 9.x'e sabitlendi. ESLint 9 "deprecated" uyarısı veriyor ama flat config ile çalışıyor. Eklentiler ESLint 10 desteği yayınlayınca birlikte yükseltilir.
Alternatif: ESLint 10 + peer uyarılarını yok saymak (kurallar sessizce bozulabilir) veya jsx-a11y'den vazgeçmek (erişilebilirlik kuralıyla çelişir).

## 007 – NestJS CommonJS kalır, tsconfig preset'leri ayrılır (2026-10-01) — yerini 008 aldı

api ve worker CommonJS derlenir. Nest ekosistemi (decorator metadata, Prisma, test araçları) CJS'de sorunsuz; ESM'e geçiş kazanç getirmeden sürtünme ekliyor. Modül ayarları ortak `base` preset'inden çıkarılır: ESM tarafı (web, ui, extension) `verbatimModuleSyntax` kullanır, Nest preset'i CommonJS kullanır.
Alternatif: Nest'i ESM (`NodeNext` + `"type": "module"`) çalıştırmak; import'larda `.js` uzantısı ve bazı kütüphanelerde uyumsuzluk getirir.

## 008 – NestJS 12 + ESM (2026-10-01)

NestJS 12 yalnızca ESM yayınlanıyor; 007'nin "Nest CJS'de sorunsuz" gerekçesi geçersiz kaldı. api ve worker `"type": "module"` ile çalışır, göreli import'lar `.js` uzantılı yazılır, `nest` preset'i de `verbatimModuleSyntax` kullanır. Repo genelinde tek modül sistemi kalır. Ayrı preset'ler (decorator ayarları, `NodeNext`) korunur.
Alternatif: Nest 11 + CommonJS; olgun ama eski ana sürüm, Nest 12'ye geçişte ESM göçü yine gerekir.

## 009 – Test runner: Vitest (2026-10-01)

Tüm paketlerde tek runner. Nest testleri `unplugin-swc` ile derlenir, çünkü esbuild `emitDecoratorMetadata` desteklemiyor ve Nest DI buna dayanıyor.
Alternatif: Jest + ts-jest (Nest varsayılanı); frontend tarafıyla iki ayrı runner olurdu.
`@swc/core`'un kurulum script'ine izin verilir (`onlyBuiltDependencies`): script yalnızca platform binary'sini doğrular; `ignoredBuiltDependencies` pnpm 10.34'te bu paket için uyarıyı susturmadı.

## 010 – Node 24 LTS (2026-10-01)

Node sürümü `>=24 <25` olarak sabitlenir (`engines`, `.nvmrc`). Node 23.7'de Nest CLI çöküyordu (`ERR_REQUIRE_CYCLE_MODULE`: `@angular-devkit/schematics` ESM-only `ora`'yı `require` ediyor); Node 24.21'de typecheck, lint, build, test ve `pnpm dev` sorunsuz geçti. 24, güncel LTS hattı.
Alternatif: Node 22 LTS; o da sorunsuz çalışıyor ama destek süresi daha kısa.

## 011 – Prisma 7 + ESM client, pgvector elle yazılan migration ile (2026-10-01)

`prisma-client` generator'ı ESM üretir (`moduleFormat = "esm"`, `importFileExtension = "js"`); çıktı `apps/api/src/generated/prisma` altında, git'e girmez, turbo `db:generate` ile üretilir. Prisma 7 driver adapter ister: `@prisma/adapter-pg` + `pg`. Prisma 7 `.env` yüklemediği için `prisma.config.ts` kökteki `.env`'i Node'un `process.loadEnvFile` ile okur (dotenv yok). Sürüm 7.10'a sabit: npm'de `prisma`'nın `latest` etiketi 8.0 RC'yi gösteriyor.
pgvector, `CREATE EXTENSION` içeren elle yazılmış bir migration ile açılır; şemada extension tanımı Prisma 7'de hâlâ deneysel (`experimental.extensions`).
Alternatif: deneysel extension desteğini açmak; kararlı olana kadar beklenir.

## 012 – UI temeli: Radix Primitives, doğrudan import yok (2026-10-02)

Bileşenler `radix-ui` üzerine kurulur. Portal'lar `container` alır (eklentinin Shadow DOM'u için şart); focus trap, klavye gezinmesi ve ARIA bağlantıları hazır gelir; stil içermez. Uygulamalar Radix'i doğrudan import etmez, yalnızca `@glint/ui` kullanır (ESLint `no-restricted-imports`); temel değişirse yalnızca `packages/ui` etkilenir.
Alternatif: Base UI (modern, aktif; ekosistemi daha küçük), React Aria Components (erişilebilirlikte en titiz; bundle büyük, Tailwind ile sürtünmeli).

## 013 – Token'lar: CSS değişkenleri, `light-dark()`, Tailwind 4 `@theme` (2026-10-02)

Üç katman: OKLCH primitive'ler, `light-dark()` ile yazılan semantic token'lar, `@theme inline` ile Tailwind utility'leri. Tema varsayılan olarak sistem tercihini izler; kökte veya shadow host'ta `data-theme` onu ezer. Varsayılan Tailwind paleti kapatılır, yalnızca token renkleri kullanılabilir. Kontrast, token'lardan WCAG oranı hesaplayan bir testle iki temada doğrulanır.
Kısıt: Lightning CSS `light-dark()`'ı köke bağlı değişkenlere çevirdiği için iç içe tema desteklenmez.
Alternatif: Tailwind 3 tarzı JS preset (runtime tema yok, CSS-first yaklaşımın gerisinde), iki ayrı tema bloğu (`[data-theme=dark] { ... }`; her token iki kez yazılır).

## 014 – `@glint/ui` derleme adımı olmadan yayınlanır (2026-10-02)

Paket `exports` ile TS kaynağını doğrudan gösterir (alt yollar: `@glint/ui/button` ...); Next (`transpilePackages`) ve Vite/WXT derlemeyi kendisi yapar. Build, watch ve turbo sıralama derdi olmaz. Barrel dosyası yoktur; alt yollar tree-shaking'i ve `'use client'` sınırlarını net tutar.
Alternatif: tsup/tsdown ile `dist` üretmek; paket npm'e yayınlanacaksa gerekir, monorepo içinde gereksiz.

## 015 – Story'ler Vitest tarayıcı testleri olarak çalışır (2026-10-02)

Storybook 10 + `@storybook/addon-vitest`: her story headless Chromium'da Vitest testi olur, `play` senaryoları çalışır, axe ihlali testi kırar (`a11y.test: 'error'`). Test runner tek kalır (009). Açık modal overlay'lerde Radix'in arka planı `aria-hidden` yapıp focus'u kilitlemesi axe'ta `aria-hidden-focus` false positive'i üretir; kural yalnızca bu story'lerde kapatılır.
Alternatif: Storybook test-runner (Jest + Playwright, ikinci runner), jsdom + Testing Library (kontrast ve focus ölçümü güvenilmez).

## 016 – Veri modeli: paylaşılan Content, kullanıcıya özel SavedLink, composite FK (2026-10-05)

Content normalize URL başına tektir (005); SavedLink, Tag, Collection, CollectionItem ve Highlight kullanıcıya aittir. `userId` Supabase auth kullanıcısının uuid'idir; auth ayrı bir veritabanında olduğu için FK verilmez. Bu yüzden Supabase'den silinen kullanıcının verisi kendiliğinden silinmez, temizliği ileride bir job yapar. Kullanıcıya ait alt kayıtlar ebeveyne `(id, user_id)` composite FK ile bağlanır: uygulama kodu hata yapsa bile veritabanı iki farklı kullanıcının kaydını birbirine bağlamayı reddeder. SavedLink soft delete'tir (`deleted_at`); aynı URL tekrar kaydedilince yeni satır açılmaz, eski satır geri getirilir. Böylece `UNIQUE(user_id, content_id)` yeterli olur ve highlight'lar korunur. ID'ler UUIDv7, zaman damgaları `timestamptz(3)`.
Alternatif: Postgres RLS (tek DB rolüyle Prisma kullanırken her transaction'da `SET LOCAL` gerektirir), soft delete + partial unique index (Prisma şemasında desteklenmiyor, elle SQL gerekir).
