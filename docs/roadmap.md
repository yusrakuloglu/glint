# Glint Roadmap

Her faz, "Bitti" kriteri sağlanmadan kapanmaz. Tamamlanan maddeleri [x] ile işaretle.

## Faz 0 – Kurulum

- [x] Turborepo iskeleti ve packages/config
- [x] Lokal Postgres + pgvector (docker-compose)
- [x] apps/web (boş Next.js), apps/api (/health), apps/worker (iskelet)
- [x] Prisma + pgvector migration
- [x] CI: lint, typecheck, test
- **Bitti:** `pnpm dev` ile web ve API açılıyor, CI yeşil

## Faz 1 – Design system (2 hafta)

- [x] Token'lar, light/dark tema
- [x] Button, Input, Dialog, Toast, Dropdown, Tooltip, Skeleton, EmptyState
- [x] Storybook + erişilebilirlik kontrolleri
- **Bitti:** Storybook yayında, bileşenler klavyeyle tamamen kullanılabiliyor ✓ (2026-10-02, https://yusrakuloglu.github.io/glint/)

## Faz 2 – Backend temeli

- [x] Veri modeli: Content, SavedLink, Chunk, Tag, Collection, Highlight
- [ ] Supabase JWT doğrulama, links CRUD
- [ ] Cursor pagination, tutarlı hata formatı, OpenAPI
- [ ] orval ile packages/api-client
- [ ] Testcontainers ile integration testleri
- **Bitti:** Web tipli client ile API'yi çağırabiliyor

## Faz 3 – İşleme pipeline'ı

- [ ] pg-boss: içerik çıkarma → özet/etiket → chunk → embedding
- [ ] Idempotency, retry/backoff, Gemini → Groq fallback
- [ ] URL bazında tekrar önleme, kullanıcı başına günlük AI limiti
- **Bitti:** Çift çalışma ve fallback testlerle kanıtlı

## Faz 4 – Web uygulaması

- [ ] Supabase Auth, korumalı route'lar
- [ ] Sanallaştırılmış liste, infinite query, URL state (nuqs)
- [ ] Optimistic update + geri alma, Realtime işleme durumu
- [ ] Cmd+K, klavye kısayolları
- [ ] Okuma modu (DOMPurify), sürükle-bırak koleksiyonlar
- **Bitti:** 10.000 linkle akıcı; ölçümler docs/performance.md'de

## Faz 5 – Arama

- [ ] Hibrit arama + Reciprocal Rank Fusion
- [ ] İndeksler, EXPLAIN ANALYZE
- [ ] Doğal dil sorgusunu filtreye çevirme
- [ ] Arama arayüzü
- **Bitti:** Sorgu süreleri ölçülüp belgelendi

## Faz 6 – Eklenti ve vurgulama motoru

- [ ] WXT ile tek tıkla kaydetme
- [ ] packages/ui Shadow DOM içinde
- [ ] Vurgulama motoru + web ile senkronizasyon
- **Bitti:** 10 popüler sitede vurgular kaydedilip geri yükleniyor

## Faz 7 – Sohbet ve paylaşım

- [ ] RAG endpoint'i (SSE, kaynak referansları)
- [ ] Sohbet arayüzü: streaming, kaynak kartları, durdurma, yeniden üretme
- [ ] Herkese açık koleksiyonlar: SSG/ISR, meta, OG görselleri
- **Bitti:** Paylaşılan link sosyal medyada önizlemeli görünüyor

## Faz 8 – Kalite ve deploy

- [ ] i18n (TR + EN)
- [ ] Playwright E2E + görsel regresyon
- [ ] Lighthouse CI, axe, Sentry, PostHog
- [ ] Oracle VM deploy, Supabase ping, pg_dump yedekleme
- **Bitti:** Her PR'da testler ve performans bütçesi otomatik çalışıyor

## Faz 9 – Yayın

- [ ] Chrome Web Store, Firefox Add-ons
- [ ] Yer imleri ve Pocket içe aktarma
- [ ] README (case study), demo videosu, iki teknik yazı
- [ ] İlk 10–20 kullanıcı
- **Bitti:** Canlı link, demo hesabı, yayında eklenti
