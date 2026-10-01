# Glint

AI destekli okuma hafızası: tarayıcı eklentisiyle link kaydet, AI özetlesin ve etiketlesin, doğal dille ara, kaydettiklerinle sohbet et.
Portfolyo projesi: frontend derinliği + gerçek backend deneyimi. Bütçe sıfır, tüm servisler ücretsiz katmanda.

## Mimari

- `apps/web`: Next.js (App Router), TypeScript, Tailwind, TanStack Query
- `apps/api`: NestJS REST API, Prisma, OpenAPI
- `apps/worker`: NestJS, api ile aynı kod tabanını paylaşır, ayrı process (pg-boss job'ları)
- `apps/extension`: WXT + React (Chrome ve Firefox), arayüz Shadow DOM içinde
- `packages/ui`: design system + Storybook (web ve eklenti ortak kullanır)
- `packages/api-client`: OpenAPI'den orval ile üretilir, ELLE DÜZENLENMEZ
- `packages/config`: ESLint, TypeScript, Tailwind ortak ayarları

Veri: Supabase Postgres + pgvector, Supabase Auth (API sadece JWT doğrular), Supabase Realtime.
AI: Vercel AI SDK; Gemini ana sağlayıcı, Groq yedek. Embedding yerel: transformers.js + multilingual-e5-small.
Kararların gerekçeleri: `docs/decisions.md`

## Komutlar

<!-- Faz 0 sonunda gerçek komutlarla güncelle -->
- `pnpm dev`: tüm uygulamaları başlatır
- `pnpm lint` / `pnpm typecheck` / `pnpm test`
- `docker compose up -d`: lokal Postgres + pgvector

## Kurallar

- Paket yöneticisi yalnızca pnpm. npm veya yarn komutu çalıştırma.
- Yeni bağımlılık eklemeden ÖNCE sor: paket adı, neden gerekli, alternatifi var mı.
- Her değişiklik küçük ve tek amaçlı olsun. İstenmeyen dosyalara dokunma.
- Kod, değişken adları ve commit mesajları İngilizce; conventional commits (`feat:`, `fix:`, `chore:` ...).
- TypeScript strict mode. `any` kullanma; gerekiyorsa nedenini yorumla belirt.
- Validasyon Zod ile. AI çıktıları her zaman bir Zod şemasıyla doğrulanır.
- Her yeni iş mantığı için test yaz ve testleri çalıştır. Testler geçmeden işi bitmiş sayma.
- `.env` dosyalarını asla commit etme; yeni bir değişken eklenirse `.env.example`'ı güncelle.
- Erişilebilirlik: tüm etkileşimli bileşenler klavyeyle kullanılabilir olmalı.
- Önemli bir mimari karar alındığında `docs/decisions.md`'ye kısa bir kayıt ekle.

## Kendim yazacağım parçalar

Bu alanlarda çekirdek mantığı ben yazarım. Sen sadece review yap, test öner, soruya cevap ver; istemediğim sürece kodu kendin yazma:
- Vurgulama motorunun eşleştirme algoritması
- Hibrit arama SQL'i ve sıralama
- Pipeline'daki idempotency mantığı

## Roadmap ve mevcut durum

Fazlar ve bitti kriterleri: `docs/roadmap.md`. Bir göreve başlamadan önce ilgili fazı oku.
Bir madde tamamlandığında `docs/roadmap.md`'de işaretle; faz bittiğinde aşağıdaki satırı güncelle.

Aktif faz: Faz 0 – Kurulum
