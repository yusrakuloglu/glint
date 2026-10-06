import { describe, expect, it } from 'vitest'

import {
  compressSnapshotHtml,
  decompressSnapshotHtml,
  stripScriptsAndStyles,
} from './page-snapshot.js'

describe('stripScriptsAndStyles', () => {
  it('removes script and style elements with their content', () => {
    const html =
      '<head><style>p { color: red }</style><script src="a.js"></script></head>' +
      '<body><p>Text</p><script type="module">if (a < b) run("</p>")</script></body>'

    expect(stripScriptsAndStyles(html)).toBe('<head></head><body><p>Text</p></body>')
  })

  it('matches tags case-insensitively, across lines and with spaces before >', () => {
    expect(stripScriptsAndStyles('<p>a</p><SCRIPT\n defer>\nx()\n</Script >\n<p>b</p>')).toBe(
      '<p>a</p>\n<p>b</p>'
    )
  })

  it('removes each element separately, keeping text between them', () => {
    expect(stripScriptsAndStyles('<script>1</script><p>keep</p><script>2</script>')).toBe(
      '<p>keep</p>'
    )
  })

  it('keeps comments, including a script tag written inside one', () => {
    const html = '<!-- <script> --><p>keep</p><script>x()</script>'

    expect(stripScriptsAndStyles(html)).toBe('<!-- <script> --><p>keep</p>')
  })

  it('removes a script that contains a comment opener', () => {
    expect(stripScriptsAndStyles('<script>s = "<!--"</script><p>keep</p>')).toBe('<p>keep</p>')
  })

  it('leaves similarly named elements and unclosed scripts alone', () => {
    const html = '<scripts>a</scripts><style-guide>b</style-guide><script>never closed'

    expect(stripScriptsAndStyles(html)).toBe(html)
  })

  it('keeps noscript, which may hold the article content', () => {
    expect(stripScriptsAndStyles('<noscript><img src="a.png"></noscript>')).toBe(
      '<noscript><img src="a.png"></noscript>'
    )
  })
})

describe('snapshot compression', () => {
  it('round-trips non-ASCII text', async () => {
    const html = '<p>Çalışma notları — 日本語 🚀</p>'.repeat(100)

    const compressed = await compressSnapshotHtml(html)

    expect(compressed.byteLength).toBeLessThan(Buffer.byteLength(html))
    await expect(decompressSnapshotHtml(compressed)).resolves.toBe(html)
  })
})
