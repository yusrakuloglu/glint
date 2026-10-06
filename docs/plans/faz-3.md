# Faz 3 – İşleme pipeline'ı: Plan

Durum: onaylandı. §1'deki kararlar 2026-10-06'da önerilen seçeneklerle netleşti (1a: A, 1b: `AWAITING_CONTENT`, 1c: ham DOM). Hazırlanma: 2026-10-06 (Faz 2 kapanışı, PR #6).

Roadmap maddeleri:

- pg-boss: içerik çıkarma → özet/etiket → chunk → embedding
- Idempotency, retry/backoff, Gemini → Groq fallback
- URL bazında tekrar önleme, kullanıcı başına günlük AI limiti

**Bitti kriteri:** Çift çalışma ve fallback testlerle kanıtlı.

İlgili kararlar: 002 (pg-boss), 003 (sayfa içeriğini eklenti gönderir), 004 (yerel embedding), 005 (özet URL bazında paylaşılır), 016 (veri modeli), 021 (Testcontainers).

---

## 1. Kararlar (onaylandı)

### 1a. Worker nerede çalışsın? (Önerim: `apps/api` içinde ikinci entrypoint)

CLAUDE.md "worker, api ile aynı kod tabanını paylaşır, ayrı process" diyor. Ama şu an `apps/worker` ayrı bir paket ve Prisma client'ı, config'i, Zod şemaları `apps/api` içinde.

| Seçenek                                                                                      | Artı                                                                                                     | Eksi                                                                                            |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **A. `apps/api/src/worker/main.ts`** (ikinci Nest entrypoint, `node dist/worker/main.js`) ✅ | Prisma, env, şemalar, Testcontainers kurulumu olduğu gibi paylaşılır. CLAUDE.md'deki tanıma birebir uyar | `apps/worker` paketi silinir, CLAUDE.md mimari bölümü güncellenir                               |
| B. `packages/db` (Prisma şeması + client + migration'lar)                                    | Paket sınırları net                                                                                      | Büyük taşıma; `db:generate` ve migration komutları değişir; config ve şemalar yine paylaşılmalı |
| C. `apps/worker`, `@glint/api`'yi workspace bağımlılığı olarak import eder                   | Paket kalır                                                                                              | Uygulamadan uygulamaya bağımlılık, döngü riski, garip `exports`                                 |

### 1b. İçeriği gelmeyen linkler ne olacak? (Önerim: 003'e sadık kal, `AWAITING_CONTENT`)

Karar 003'e göre sunucuda scraping yok. Ama web'den yalnızca URL yapıştırılarak kaydedilen linkler (Faz 4) için sayfa içeriği hiç gelmeyecek.

- **Öneri:** Bu Content'ler `AWAITING_CONTENT` durumunda kalır. Aynı URL'yi eklentiyle kaydeden ilk kişinin gönderdiği içerik herkese yarar (005).
- **Alternatif:** Yalnızca public sayfalar için sunucu tarafında fetch fallback'i. Bu 003'ü değiştirir; SSRF koruması, robots.txt, timeout ve boyut limiti gerekir.

### 1c. Eklenti ne göndersin? (Önerim: serileştirilmiş DOM, çıkarma sunucuda)

| Seçenek                                               | Artı                                                                                                                                    | Eksi                                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Ham DOM (`document.documentElement.outerHTML`)** ✅ | Çıkarma mantığı tek yerde, test edilebilir; roadmap'teki "içerik çıkarma" adımı worker'da; çıkarıcı iyileşince yeniden çalıştırılabilir | Payload büyük (birkaç MB). Body limiti ve geçici saklama gerekir           |
| Eklenti Readability'yi kendisi çalıştırır             | Payload küçük                                                                                                                           | Çıkarma eklentiye gömülür, sürüm kaosu; sunucu adımı sadece doğrulama olur |

Şu an eklenti yok (Faz 6). Faz 3'te içerik API'ye doğrudan gönderilir; testler ve geliştirme sırasında elle gönderilebilir.

---

## 2. Akış

```
POST /links { url, page?: { html, lang? } }
  └─ API (tek transaction):
       Content upsert → (page varsa) page_snapshots'a yaz
       → kota kontrolü → pg-boss "content.extract" (singletonKey = contentId)

worker:
  content.extract   linkedom + Readability → text, article html, title, byline, siteName, lang, contentHash
                    snapshot'ı sil → "content.summarize" gönder
  content.summarize AI SDK generateObject (Zod şeması: summary, tags[], language)
                    Gemini → hata/şema ihlali → Groq → "content.chunk"
  content.chunk     token sayısına göre ~400 token, 50 overlap; chunks tablosunu tek transaction'da değiştir
                    → "content.embed"
  content.embed     transformers.js multilingual-e5-small ("passage: " ön eki), vector(384) → READY
                    → "content.apply-tags" (AI etiketlerini kullanıcıların SavedLink'lerine bağla)
  reconciler (cron, 5 dk)  belirli bir süredir aynı adımda takılı Content'leri yeniden kuyruğa koy
```

### Adım tasarımının ilkeleri

- **Her adım idempotent:**
  - Önce Content'in `processingStep` ve `contentHash` değerlerine bakar. İş zaten yapılmışsa hiçbir şey yazmadan bir sonraki adımı gönderir.
  - Yazma koşulludur: `UPDATE ... WHERE id = $1 AND processing_step = 'summarize' AND content_hash = $2`. Aynı anda çalışan iki kopyadan yalnızca biri yazar.
- **Adımlar arası atomiklik:** "Yaz ve sonraki job'ı gönder" iki ayrı sistem; arada çökme olabilir.
  - pg-boss `send`'in `db` seçeneğiyle aynı transaction'da gönderilmesi değerlendirilecek. Prisma transaction'ı ham bir pg client vermediği için büyük ihtimalle mümkün olmayacak.
  - O durumda çözüm: idempotent adımlar + reconciler cron'u. Takılı kalan Content yeniden kuyruğa girer ve adım "zaten yapılmış" diyerek ilerler.
- **Kalıcı ve geçici hata ayrımı:**
  - Kalıcı hatalar retry edilmez; Content `FAILED` olur ve `failureReason` yazılır. Örnekler: içerik çok kısa, Readability makale bulamadı, iki sağlayıcı da şemaya uymadı.
  - Geçici hatalar (429, 5xx, timeout) pg-boss retry'ına bırakılır: `retryLimit: 5`, `retryDelay: 30`, `retryBackoff: true`.

---

## 3. Veri modeli değişiklikleri (migration)

- **`ContentStatus`:** `AWAITING_CONTENT` eklenir (1b'ye bağlı). `PENDING`, "kuyrukta" anlamına geçer.
- **Content'e eklenecek alanlar:**
  - `processingStep` (enum: `EXTRACT`, `SUMMARIZE`, `CHUNK`, `EMBED`, `DONE`)
  - `contentHash` (çıkarılan metnin sha256'sı)
  - `text` (düz metin)
  - `articleHtml` (Readability çıktısı; sanitize edilmez, Faz 4'te DOMPurify ile render'da sanitize edilir)
  - `byline`, `excerpt`, `wordCount`
  - `suggestedTags String[]`
  - `aiProvider` (`gemini` veya `groq`, gözlemlenebilirlik için)
  - `failureReason`, `statusChangedAt`
- **`page_snapshots`:** `id`, `content_id`, `user_id`, `html`, `created_at`. Geçici bir tablo; çıkarma adımından sonra silinir. Ham HTML pg-boss job payload'una konmaz, çünkü pg-boss archive tablosu şişer.
- **`ai_usage`:** `(user_id, day)` PK ve `count`. Kota için.
- **HNSW index:** Faz 5'e bırakılır (planda öyle).
- **Boyut notu:** Supabase ücretsiz katmanı 500 MB. Ham HTML saklanmaz; `articleHtml` + `text` + chunk'lar link başına kabaca 50–150 KB. 10.000 link için Faz 8'de ölçülmeli.

## 4. API değişiklikleri

- **`POST /links`:** Body'ye opsiyonel `page: { html: string (≤ 5 MB), lang?: string }` eklenir. JSON body limiti şu an Express varsayılanı 100 KB; yalnızca bu route için 5 MB yapılır.
  - Content `READY` ise snapshot yazılmaz, job gönderilmez. Bu, URL bazında tekrar önlemenin birinci katmanı.
- **Yanıta eklenecek alanlar:** `excerpt`, `suggestedTags`. `status` zaten var.
- **Gerekirse `POST /links/:id/content`:** Mevcut bir link için sonradan içerik göndermek. Eklenti akışı netleşince (Faz 6) karar verilir; şimdilik eklenmez.

## 5. Tekrar önleme (URL bazında)

Üç katman:

1. **Content tablosu:** Normalize URL başına tek Content (016, 017).
2. **pg-boss `singletonKey: contentId`:** Aynı Content için kuyrukta ya da çalışırken ikinci bir job oluşmaz. Aynı URL'yi aynı anda kaydeden iki kullanıcı tek pipeline başlatır.
3. **Adım içi koşullu yazma:** Yukarıdaki iki katman bir şekilde aşılırsa, aynı anda çalışan iki kopya yine çift yazmaz (§2).

## 6. Günlük AI kotası

- **Ne sayılır:** Yalnızca AI çağrısı gerektiren işler. Hazır özeti olan bir URL'yi kaydetmek kotayı harcamaz (005).
- **Nasıl:** Job gönderilirken `INSERT INTO ai_usage ... ON CONFLICT DO UPDATE SET count = count + 1 WHERE ai_usage.count < $limit RETURNING count`. Satır dönmezse kota dolmuştur.
- **Kota doluysa:** Link yine de kaydedilir. Job, pg-boss `startAfter` ile ertesi gün 00:00 UTC'ye ertelenir. Kullanıcıyı engellemek yerine işi kaydırıyoruz; link yanıtında `status: PENDING` görünür.
- **Ayar:** `AI_DAILY_LIMIT_PER_USER` env değişkeni, varsayılan 50.
- **Sınır:** Paylaşılan bir Content'i ilk tetikleyen kullanıcının kotası harcanır. Diğer kullanıcılar bedavaya yararlanır; bu bilinçli bir tercih.

## 7. AI: özet, etiket, fallback

- **Kütüphane:** Vercel AI SDK `generateObject` + Zod şeması. AI çıktısı her zaman doğrulanır (CLAUDE.md kuralı).
  - `summary`: 2–4 cümle
  - `tags`: 3–7 adet, küçük harf
  - `language`: ISO 639-1
- **Özetin dili:** İçeriğin dili. Content paylaşıldığı için kullanıcının diline göre değil.
- **Fallback zinciri:** Gemini → Groq. Groq'a geçme nedenleri:
  - 429 veya 5xx,
  - timeout (20 sn),
  - şema ihlali (bir kez onarım denemesinden sonra).
- **Gemini'yi geçici olarak devreden çıkarma:** Gemini 429 dönünce worker belleğinde 60 sn boyunca doğrudan Groq'a gidilir. Bu hafif bir circuit breaker; dağıtık değil, tek worker için yeterli.
- **Uzun içerik:** Model bağlam sınırı ve ücretsiz katman token limitleri için ilk ~12.000 token gönderilir.
- **Model adları env'de:** `GEMINI_MODEL`, `GROQ_MODEL`. Sağlayıcılar model adlarını sık değiştiriyor; uygulama sırasında ücretsiz katmanda geçerli olanlar seçilecek.
- **Testler gerçek sağlayıcıya gitmez:** `ai/test` içindeki mock language model kullanılır. Yeni bağımlılık gerekmez.

## 8. Chunk ve embedding

- **Model:** transformers.js (`@huggingface/transformers`) + `Xenova/multilingual-e5-small` (384 boyut, 004).
- **e5 ön ekleri:** Dokümanlara `passage: `, Faz 5'teki sorgulara `query: ` ön eki konur. Unutulursa kalite ciddi düşer; testle sabitlenir.
- **Chunking:**
  - Paragraf sınırlarına saygılı birleştirme.
  - Model tokenizer'ı ile ~400 token, 50 token overlap. e5'in sınırı 512 token.
- **Yazma:** Chunk'lar tek transaction'da yazılır: önce `DELETE` sonra `INSERT`. Unique `(content_id, index)` kısıtı çift yazmayı da engeller. `embedding` raw SQL ile yazılır, `id` kodda üretilir (Prisma `uuid(7)` DB default'u değil, bkz. veri modeli dokümanı).
- **Model dosyası:** ~120 MB. Worker açılışında bir kez indirilir; cache dizini `TRANSFORMERS_CACHE` ile verilir. CI'da indirilmez: testlerde deterministik sahte bir embedder kullanılır. Gerçek model için ayrı ve elle çalıştırılan bir smoke test (`pnpm --filter @glint/api test:model`) olur.
- **Native bağımlılıklar:** `onnxruntime-node` ve `sharp` kurulum script'i istiyor. `onlyBuiltDependencies`'e eklenmeleri gerekecek; ikisi de platform binary'si indiriyor. `sharp` yalnızca görsel işleme için; gerekmiyorsa ignore edilebilir mi, uygulamada denenecek.

## 9. Test stratejisi ("Bitti" kriterinin kanıtı)

Integration testleri (Testcontainers; pg-boss aynı container'da kendi şemasını kurar):

| Senaryo                                            | Kanıtladığı                                                                |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| Aynı `content.summarize` job'ı arka arkaya iki kez | AI bir kez çağrılır (mock çağrı sayacı), özet bir kez yazılır              |
| Aynı adımın iki kopyası aynı anda (`Promise.all`)  | Koşullu yazma: biri yazar, diğeri no-op; chunk sayısı iki katına çıkmaz    |
| İki kullanıcı aynı URL'yi aynı anda kaydeder       | Tek job (`singletonKey`), tek pipeline                                     |
| READY bir URL tekrar kaydedilir                    | Job gönderilmez, kota harcanmaz                                            |
| Gemini 429 → Groq                                  | Özet Groq'tan gelir, `aiProvider = groq`                                   |
| Gemini şema dışı JSON → Groq                       | Zod doğrulaması fallback'i tetikler                                        |
| Gemini ve Groq ikisi de 5xx                        | pg-boss retry eder, backoff ile; limit aşılınca `FAILED` + `failureReason` |
| Kalıcı hata (makale yok)                           | Retry yok, hemen `FAILED`                                                  |
| Adım yazıldı ama sonraki job gönderilmeden çöktü   | Reconciler yeniden kuyruğa koyar, pipeline tamamlanır                      |
| Kota: limit+1'inci işleme                          | Job ertesi güne ertelenir, link kaydı başarılı                             |

Unit testler:

- Readability çıkarma: birkaç sabit HTML fixture'ı.
- Chunker sınırları.
- e5 ön ekleri.
- Fallback karar mantığı.
- Kota tarih hesabı (UTC gün sınırı).

Testlerin gerçekten koruduğu, Faz 2'deki gibi kod kasıtlı bozularak (mutation check) doğrulanacak.

## 10. Paketler (eklemeden önce onay gerekiyor)

| Paket                       | Sürüm    | Nerede | Neden                                                                                                                                |
| --------------------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pg-boss`                   | ^12.36.0 | api    | Kuyruk (002). Cron (`schedule`) ve `singletonKey` dahil. 12.37.0 05.10'da yayınlandı; `minimumReleaseAge` yüzünden 12.36 kurulabilir |
| `ai`                        | ^7.0.128 | api    | Vercel AI SDK, `generateObject`, `ai/test` mock'ları                                                                                 |
| `@ai-sdk/google`            | ^4.0.88  | api    | Gemini sağlayıcısı                                                                                                                   |
| `@ai-sdk/groq`              | ^4.0.55  | api    | Groq yedek sağlayıcısı                                                                                                               |
| `@huggingface/transformers` | ^4.3.0   | api    | Yerel embedding ve tokenizer (004). Native: `onnxruntime-node`, `sharp`                                                              |
| `@mozilla/readability`      | ^0.6.0   | api    | Makale çıkarma (son sürüm 2025-03; olgun, yavaş güncelleniyor)                                                                       |
| `linkedom`                  | ^0.18.13 | api    | Readability için hafif sunucu DOM'u (jsdom'dan çok daha hafif). `canvas` peer'i opsiyonel                                            |

**Doğrulanacaklar:**

- pg-boss'un `@opentelemetry/api` peer'i opsiyonel mi (`peerDependenciesMeta`'da görünmüyor)? Değilse ayrıca sorulacak.
- `onnxruntime-node` kurulum script'i ve CI süresine etkisi.

**Eklenmeyecekler:**

- `@nestjs/schedule`: pg-boss cron'u yeterli.
- jsdom: linkedom yeterli.
- `sanitize-html` / DOMPurify (sunucu): sanitize, Faz 4'te render sırasında yapılıyor.
- Redis: 002.

**Yeni env değişkenleri** (`.env.example`):

- `GEMINI_API_KEY`, `GROQ_API_KEY`
- `GEMINI_MODEL`, `GROQ_MODEL`
- `AI_DAILY_LIMIT_PER_USER`
- `TRANSFORMERS_CACHE`

## 11. PR ve commit sırası

Her PR main'den ayrı bir branch'te açılır; CI geçince sen merge edersin.

**PR 1 – Worker altyapısı ve içerik alma** (`feat/worker-foundation`)

1. `docs: add Phase 3 plan`: bu dosya.
2. `refactor: move worker into apps/api as a second entrypoint`: 1a'ya bağlı. `apps/worker` silinir, CLAUDE.md güncellenir, decisions 025.
3. `chore(api): add pg-boss and queue module`: API'de producer, worker'da consumer. Graceful shutdown. Testcontainers'ta pg-boss.
4. `feat(api): extend content model for processing`: migration (§3).
5. `feat(api): accept page snapshots on save`: `POST /links` `page` alanı, 5 MB body limiti, snapshot + enqueue, READY ise atla.
6. `feat(api): enforce daily AI quota per user`: `ai_usage`, `startAfter` ile erteleme.
7. `docs(learn): pg-boss and queue basics`

**PR 2 – Çıkarma ve özet** (`feat/extract-summarize`)

1. `feat(worker): extract articles with Readability`: fixture testleri.
2. `feat(worker): summarize and tag with Gemini and Groq fallback`: AI SDK, Zod şeması, circuit breaker, decisions 026.
3. `test(worker): prove idempotent steps and provider fallback`: §9 tablosunun AI kısmı.
4. `docs(learn): AI fallback, idempotency`

**PR 3 – Chunk, embedding, reconciler** (`feat/chunk-embed`)

1. `feat(worker): chunk content by tokens`
2. `feat(worker): embed chunks with multilingual-e5-small`: decisions 027 (model dosyası, native bağımlılıklar).
3. `feat(worker): apply AI tags to saved links`
4. `feat(worker): requeue stuck content with a reconciler`: §9'un çökme senaryosu.
5. `docs(learn): chunking and embeddings, reconciler`
6. `docs: close Phase 3`: roadmap, CLAUDE.md "Aktif faz".

## 12. `docs/learn` dokümanları

- `pg-boss-ve-kuyruklar.md`: Postgres üzerinde kuyruk, `SKIP LOCKED`, singletonKey, retry/backoff, graceful shutdown
- `idempotent-pipeline.md`: koşullu yazma, at-least-once teslim, reconciler, outbox ile kıyas
- `ai-fallback-ve-dogrulama.md`: generateObject, Zod ile çıktı doğrulama, fallback ve circuit breaker
- `ai-kotasi.md`: atomik sayaç, erteleme, paylaşılan içerikte adil kullanım
- `icerik-cikarma.md`: Readability, linkedom, neden scraping yok (003)
- `chunking-ve-embedding.md`: e5 ön ekleri, token bazlı chunk, vector(384), yerel model

## 13. Uygulama sırasında doğrulanacaklar

- pg-boss 12 API'si: `send`'in `db` seçeneği (aynı transaction'da gönderme), `singletonKey` ve `singletonSeconds` davranışı, `localConcurrency`, `schedule`.
- Gemini ve Groq ücretsiz katmanında geçerli model adları ve rate limit'leri.
- Express body limitinin yalnızca bir route için yükseltilmesinin Nest 12'deki yolu.
- transformers.js 4'te e5-small'ın quantized ONNX dosyası, ilk yüklemedeki indirme ve CI'ın etkilenmediği.
