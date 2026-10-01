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
