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

## 007 – NestJS CommonJS kalır, tsconfig preset'leri ayrılır (2026-10-01)

api ve worker CommonJS derlenir. Nest ekosistemi (decorator metadata, Prisma, test araçları) CJS'de sorunsuz; ESM'e geçiş kazanç getirmeden sürtünme ekliyor. Modül ayarları ortak `base` preset'inden çıkarılır: ESM tarafı (web, ui, extension) `verbatimModuleSyntax` kullanır, Nest preset'i CommonJS kullanır.
Alternatif: Nest'i ESM (`NodeNext` + `"type": "module"`) çalıştırmak; import'larda `.js` uzantısı ve bazı kütüphanelerde uyumsuzluk getirir.
