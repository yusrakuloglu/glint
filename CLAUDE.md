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

Node 24 (`.nvmrc`), pnpm sürümü `packageManager` alanından (corepack). İlk kurulum: `pnpm install`, `cp .env.example .env`, `pnpm db:up`, `pnpm db:migrate`, `pnpm --filter @glint/ui exec playwright install chromium` (story testleri için).

- `pnpm dev`: web (:3000), api (:3001) ve worker'ı izleme modunda başlatır
- `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build`: turbo ile tüm paketlerde; CI ilk üçünü çalıştırır
- `pnpm format` / `pnpm format:check`: Prettier
- `pnpm db:up` / `pnpm db:down`: lokal Postgres + pgvector (docker compose)
- `pnpm db:migrate`: bekleyen migration'ları uygular (`prisma migrate dev`)
- `pnpm --filter @glint/api db:migrate --name <ad>`: şema değişikliğinden yeni migration üretir
- `pnpm db:generate`: Prisma client'ı üretir; build/lint/typecheck/test/dev bunu otomatik çalıştırır
- `pnpm --filter @glint/ui storybook` / `build-storybook`: Storybook (:6006) / statik build (`storybook-static/`)
- Tek paket: `pnpm --filter @glint/<web|api|worker|ui> <script>`

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
- UI primitive'leri: `radix-ui` / `@radix-ui/*` yalnızca `packages/ui` içinde import edilir; uygulamalar sadece `@glint/ui` bileşenlerini kullanır (ESLint `no-restricted-imports` ile zorunlu).
- Önemli bir mimari karar alındığında `docs/decisions.md`'ye kısa bir kayıt ekle.

## Öğrenme dokümantasyonu

Her önemli parça için `docs/learn/` altında bir öğrenme dokümanı yazılır. Bir parça, dokümanı yazılmadan bitmiş sayılmaz.

Dosya adı konu bazlı: `docs/learn/<konu>.md` (örn. `contrast-check.md`, `idempotency.md`).
`docs/learn/README.md` tüm dokümanların fazlara göre listesidir; her yeni dokümanda güncellenir.

Her doküman şu bölümlerden oluşur:

1. **Ne yaptık:** 2–3 cümlelik özet
2. **Neden:** Çözülen problem, değerlendirilen alternatifler, ilgili `decisions.md` kaydı
3. **Nasıl çalışıyor:** Adım adım açıklama, ilgili dosya ve fonksiyon referanslarıyla. Kodu tekrar yapıştırma, referans ver.
4. **Sınır durumları ve kısıtlar:** Neyin çalışmadığı, bilinen riskler
5. **Mülakat soruları:** 5–8 soru (temelden derine). Her cevap `<details>` içinde gizli olsun ki kendimi test edebileyim.
6. **Kendini test et:** Kodu kapatıp anlatabilmem gereken 3–4 madde

Dil: sade Türkçe, teknik terimler İngilizce kalabilir. Kısa tut; her doküman en fazla 2 sayfa.
Commit tipi: `docs(learn): ...`

## Roadmap ve mevcut durum

Fazlar ve bitti kriterleri: `docs/roadmap.md`. Bir göreve başlamadan önce ilgili fazı oku.
Bir madde tamamlandığında `docs/roadmap.md`'de işaretle; faz bittiğinde aşağıdaki satırı güncelle.

Aktif faz: Faz 2 – Backend temeli
