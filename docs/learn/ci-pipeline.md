# CI pipeline

## Ne yaptık

Her `main` push'unda ve her pull request'te GitHub Actions lint, typecheck ve test çalıştırıyor. Workflow: [.github/workflows/ci.yml](../../.github/workflows/ci.yml).

## Neden

- Hatalar merge'den önce yakalansın; "benim makinemde çalışıyordu" durumu olmasın.
- Kurulum tekrarlanabilir olsun: aynı Node, aynı pnpm, aynı lockfile.
- GitHub Actions public repolarda ücretsiz ve repo ile entegre. Bütçe sıfır.
- Alternatif olarak CircleCI veya GitLab CI ayrı hesap ve entegrasyon gerektirirdi.

## Nasıl çalışıyor

1. **Tetikleyiciler:** `push` (yalnızca `main`) ve `pull_request`. Feature branch'ler PR açılınca kontrol edilir; push'larda iki kez çalışmaz.
2. **`concurrency`:**
   - Aynı ref için yeni bir çalışma başlarsa eskisi iptal edilir (`cancel-in-progress`).
   - Bir PR'a arka arkaya push yapıldığında yalnızca sonuncusu çalışır, dakika harcanmaz.
3. **`permissions: contents: read`:** `GITHUB_TOKEN` yalnızca okuma yetkisiyle gelir. Ele geçirilmiş bir action repoya yazamaz (en az yetki ilkesi).
4. **Adımlar:**
   - `checkout`
   - `pnpm/action-setup`: sürümü `packageManager` alanından alır.
   - `setup-node`: sürümü `.nvmrc`'den alır, pnpm store'unu cache'ler.
   - `pnpm install --frozen-lockfile`
   - `playwright install --only-shell chromium`: story testleri için headless Chromium ([storybook-ve-a11y-testleri](storybook-ve-a11y-testleri.md))
   - `lint`, `typecheck`, `test`
5. **`--frozen-lockfile`:** Lockfile `package.json` ile uyuşmuyorsa kurulum hata verir. CI asla lockfile'ı sessizce güncellemez.
6. **Turbo'nun rolü:** Her komut turbo üzerinden tüm paketlerde çalışır. `db:generate` bağımlılığı sayesinde Prisma client otomatik üretilir. Veritabanı gerekmez, çünkü `prisma generate` URL istemiyor ([prisma.config.ts](../../apps/api/prisma.config.ts)).
7. **Sıra:** Lint en hızlı geri bildirimi verdiği için önce çalışır. Bir adım başarısız olursa sonrakiler çalışmaz.

## Sınır durumları ve kısıtlar

- Remote turbo cache yok; her çalışma tüm görevleri sıfırdan yapar. Ölçek büyüyünce süre uzar.
- `build` ve `format:check` CI'da yok. Derleme hatası veren ama typecheck'ten geçen bir şey (ör. Next'e özgü hata) kaçabilir.
- Integration testleri için veritabanı servisi henüz yok (Faz 2'de Testcontainers).
- **Planlananlar:**
  - Faz 1: Storybook'un GitHub Pages'e yayını.
  - Faz 8: E2E testleri ve Lighthouse CI.

## Mülakat soruları

1. CI'da neden `pnpm install` yerine `--frozen-lockfile` kullanılır?
   <details><summary>Cevap</summary>Lockfile tek doğruluk kaynağıdır. Frozen modda uyuşmazlık hata verir; böylece CI'da test edilen bağımlılıklar geliştiricinin kilitlediği bağımlılıklarla birebir aynı olur.</details>
2. `concurrency` + `cancel-in-progress` ne işe yarar?
   <details><summary>Cevap</summary>Aynı grup (burada ref) için yalnızca bir çalışma sürer; yenisi gelince eskisi iptal edilir. Eskimiş commit'ler için dakika harcanmaz.</details>
3. `GITHUB_TOKEN` yetkilerini neden kısıtlarız?
   <details><summary>Cevap</summary>Üçüncü parti action'lar token'a erişebilir. Bir action ele geçirilirse yetkisi kadar zarar verebilir. Varsayılanı salt okumaya çekmek en az yetki ilkesidir.</details>
4. Flaky test nedir, CI'da nasıl ele alınır?
   <details><summary>Cevap</summary>Kod değişmeden bazen geçip bazen kalan test. Kök neden bulunur (zamanlama, paylaşılan state, ağ). Kısa vadede karantinaya alınabilir. Otomatik retry belirtiyi gizler, son çare olmalı.</details>
5. CI'ı hızlandırmak için hangi yollar var?
   <details><summary>Cevap</summary>Bağımlılık cache'i (burada pnpm store), remote build cache (turbo), yalnızca etkilenen paketleri çalıştırmak (`turbo --filter=...[origin/main]`), işleri paralel job'lara bölmek, hızlı adımları öne almak.</details>
6. Action'ları `@v7` yerine commit SHA ile sabitlemek neden önerilir?
   <details><summary>Cevap</summary>Tag'ler taşınabilir; ele geçirilmiş bir action'ın tag'i zararlı commit'e çekilebilir. SHA değişmez. Bedeli: güncellemelerin elle (veya Dependabot ile) yapılması.</details>

## Kendini test et

- Workflow'daki her adımı sırayla ve "neden orada olduğunu" söyleyerek anlat.
- CI'da veritabanı olmadan Prisma client'ın nasıl üretildiğini açıkla.
- Şu an CI'ın yakalayamayacağı iki hata türü say.
