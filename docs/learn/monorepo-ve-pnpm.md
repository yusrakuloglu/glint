# Monorepo ve pnpm

## Ne yaptık

Tüm uygulamaları (web, api, worker, ileride eklenti) ve paylaşılan paketleri tek repoda, pnpm workspace + Turborepo ile yönetiyoruz. Ortak ESLint, TypeScript ve Prettier ayarları `@glint/config` paketinde duruyor.

## Neden

- Web, API, worker ve eklenti aynı tipleri ve UI bileşenlerini kullanıyor. Ayrı repolarda bu paylaşım paket yayınlamayı ve sürüm senkronizasyonunu gerektirirdi ([decisions.md 001](../decisions.md)).
- **pnpm:** Hızlı, disk dostu (content-addressable store), workspace desteği güçlü. Bağımlılıkların install script'lerini varsayılan olarak çalıştırmıyor.
- **Turborepo:** Görevleri bağımlılık sırasına göre çalıştırıyor ve sonuçları cache'liyor.
- **Alternatifler:** npm/yarn workspaces tek başına görev orkestrasyonu sunmuyor. Nx daha güçlü ama bu ölçek için ağır.

## Nasıl çalışıyor

1. **Workspace:** [pnpm-workspace.yaml](../../pnpm-workspace.yaml), `apps/*` ve `packages/*` klasörlerini paket olarak tanıyor. Paketler birbirine `"@glint/config": "workspace:*"` ile bağlanıyor; pnpm bunu symlink'e çeviriyor, npm'den indirmiyor.
2. **Görev grafiği:** [turbo.json](../../turbo.json)
   - `"dependsOn": ["^build"]`: Önce bağımlı olunan paketlerin `build`'i çalışır (`^` "bağımlılıklarımda" demek).
   - `lint`, `typecheck`, `test`, `dev` ayrıca `db:generate`'e bağlı. Prisma client üretilmeden api derlenemez.
   - `outputs`: Cache'lenecek çıktılar. Girdiler değişmediyse turbo görevi çalıştırmaz, sonucu cache'ten geri yükler.
3. **Derleme adımı olmayan paketler:** `@glint/config` ve `@glint/ui` derlenmiyor. `exports` alanı doğrudan kaynak dosyayı gösteriyor ve tüketici (Next, Vite) derlemeyi kendisi yapıyor. Bu sayede watch modu ve build sırası derdi yok.
4. **Güvenlik ayarları** ([pnpm-workspace.yaml](../../pnpm-workspace.yaml)):
   - `minimumReleaseAge: 1440`: Yeni yayınlanan bir sürüm 1 gün bekletilir. Ele geçirilmiş paketler genelde saatler içinde fark edilip kaldırılıyor.
   - `onlyBuiltDependencies`: Install script'i çalışmasına izin verilen paketlerin listesi (prisma, esbuild, @swc/core). Yeni bir paket script isterse `pnpm approve-builds` ile tek tek onaylanır.
   - `ignoredBuiltDependencies`: Script'i bilerek engellenen paketler, uyarı vermesinler diye.
5. **Sürüm sabitleme:** pnpm sürümü kök [package.json](../../package.json)'daki `packageManager` alanından Corepack ile geliyor. Node sürümü `.nvmrc` ve `engines` (`>=24 <25`) ile belirleniyor.

## Sınır durumları ve kısıtlar

- `minimumReleaseAge`, acil güvenlik yamalarını da 1 gün geciktirir.
- `engines` yalnızca uyarı verir, kurulumu durdurmaz. Shell yanlış Node sürümündeyse komutlar yine çalışır ama beklenmedik hatalar çıkabilir. Çözüm: `nvm use`.
- zsh'te `pnpm add @glint/config@workspace:*` "no matches found" hatası verir; `*` glob olarak yorumlanıyor. Tırnak içinde yazılmalı: `'@glint/config@workspace:*'`.
- Remote cache yok. Turbo cache yalnızca lokal makinede işe yarıyor, CI her seferinde sıfırdan çalışıyor.

## Mülakat soruları

1. Monorepo ile polyrepo arasındaki temel trade-off nedir?
   <details><summary>Cevap</summary>Monorepo: atomik değişiklik (API + client aynı commit'te), kolay kod paylaşımı, tek araç zinciri. Bedeli: araçların ölçeklenmesi (cache, görev grafiği), CI süresi, sahiplik sınırlarının bulanıklaşması. Polyrepo: bağımsız sürümleme ve izolasyon, ama paylaşım için paket yayınlamak ve sürüm senkronizasyonu gerekir.</details>
2. `workspace:*` ne yapar?
   <details><summary>Cevap</summary>Bağımlılığın registry'den değil workspace'teki paketten alınmasını sağlar; pnpm symlink oluşturur. Paket yayınlanırsa `*` gerçek sürüm numarasıyla değiştirilir.</details>
3. "Phantom dependency" nedir, pnpm bunu nasıl önler?
   <details><summary>Cevap</summary>package.json'da olmayan ama hoisting yüzünden `node_modules`'da bulunduğu için import edilebilen paket. pnpm her paketin `node_modules`'una yalnızca kendi bildirdiği bağımlılıkları koyar (sıkı yapı); bildirilmemiş paket import edilemez.</details>
4. Install script'leri neden risklidir?
   <details><summary>Cevap</summary>`postinstall` gibi script'ler kurulum sırasında geliştirici makinesinde veya CI'da rastgele kod çalıştırır. Supply chain saldırılarının en yaygın yolu budur (token çalma, zararlı yazılım). İzin listesi saldırı yüzeyini daraltır.</details>
5. Turbo'daki `^build` ile `build` farkı nedir?
   <details><summary>Cevap</summary>`^build`: Bu paketin bağımlılıklarının build görevi önce çalışsın. `build` (şapkasız): Aynı paketin build görevi önce çalışsın.</details>
6. Turbo bir görevin cache'ten gelip gelmeyeceğine nasıl karar verir?
   <details><summary>Cevap</summary>Görevin girdilerinden (paketteki dosyalar, bağımlılıkların hash'leri, ortam değişkenleri, turbo.json ayarı) bir hash üretir. Aynı hash daha önce görüldüyse `outputs` ve log geri yüklenir, görev çalıştırılmaz.</details>
7. Derleme adımı olmayan (internal) paketlerin avantajı ve dezavantajı nedir?
   <details><summary>Cevap</summary>Avantajı: build ve watch süreci yok, değişiklik anında görünür. Dezavantajı: tüketici derlemeyi kendi yapmak zorunda (Next'te `transpilePackages`), paket npm'e olduğu gibi yayınlanamaz, her tüketici paketi yeniden derler.</details>

## Kendini test et

- `pnpm lint` çalıştığında turbo hangi sırayla neyi çalıştırır, neden `db:generate` önce gelir?
- pnpm'in üç güvenlik ayarını ve her birinin hangi saldırıya karşı olduğunu anlat.
- `@glint/ui`'daki bir değişiklik web'e nasıl, hangi adımlardan geçerek yansır?
