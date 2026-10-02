# Öğrenme dokümanları

Projede yapılan her önemli parçanın "ne, neden, nasıl" özeti. Amaç: kodu kapatıp anlatabilmek ve mülakata hazırlanmak.

Her doküman aynı altı bölümden oluşur: Ne yaptık, Neden, Nasıl çalışıyor, Sınır durumları ve kısıtlar, Mülakat soruları (cevaplar `<details>` içinde), Kendini test et. Kural ve yazım biçimi: [CLAUDE.md](../../CLAUDE.md), karar kayıtları: [decisions.md](../decisions.md).

## Faz 0 – Kurulum

| Doküman                                     | Konu                                              |
| ------------------------------------------- | ------------------------------------------------- |
| [monorepo-ve-pnpm](monorepo-ve-pnpm.md)     | pnpm workspace, Turborepo görev grafiği, güvenlik |
| [typescript-ve-esm](typescript-ve-esm.md)   | tsconfig preset'leri, ESM'e geçiş                 |
| [ci-pipeline](ci-pipeline.md)               | GitHub Actions: lint, typecheck, test             |
| [nestjs-temeli](nestjs-temeli.md)           | Modüller, health endpoint'i, Vitest + SWC         |
| [prisma-ve-pgvector](prisma-ve-pgvector.md) | Prisma 7 ESM client, pgvector migration'ı         |

## Faz 1 – Design system (devam ediyor)

| Doküman                                                     | Konu                                           |
| ----------------------------------------------------------- | ---------------------------------------------- |
| [design-tokens](design-tokens.md)                           | Üç katmanlı token'lar, light/dark tema         |
| [radix-ve-ui-mimarisi](radix-ve-ui-mimarisi.md)             | Neden Radix, `@glint/ui` sınırı, portal yapısı |
| [contrast-check](contrast-check.md)                         | OKLCH → sRGB dönüşümü, WCAG kontrast testi     |
| [storybook-ve-a11y-testleri](storybook-ve-a11y-testleri.md) | Story'ler Vitest testi olarak, axe kontrolleri |
| [button](button.md)                                         | Varyantlar (cva), `asChild`, loading ve focus  |

## Okuma sırası

1. monorepo-ve-pnpm ve typescript-ve-esm: diğer her şey bunların üstüne kurulu.
2. nestjs-temeli ve prisma-ve-pgvector: backend tarafı.
3. ci-pipeline: hepsinin otomatik kontrolü.
4. design-tokens, contrast-check, radix-ve-ui-mimarisi, storybook-ve-a11y-testleri ve bileşen dokümanları (button ...): frontend tarafı.
