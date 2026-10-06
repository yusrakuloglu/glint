import { promisify } from 'node:util'
import { gunzip, gzip } from 'node:zlib'

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

/**
 * Comments, or script/style elements with their content. One left-to-right
 * pass, so `<script>` inside a comment and `<!--` inside a script are each
 * handled by whichever starts first. Script and style are raw text elements:
 * their content ends at the first matching end tag, which a regex can find.
 */
const COMMENT_OR_RAW_TEXT = /<!--[\s\S]*?-->|<(script|style)(?=[\s/>])[^>]*>[\s\S]*?<\/\1\s*>/gi

/** Decompressed snapshots are never larger than this; guards against corrupt data */
const MAX_DECOMPRESSED_BYTES = 32 * 1024 * 1024

/**
 * Removes script and style elements, which article extraction ignores and
 * which often make up much of a page. Comments are kept as they are. An
 * unclosed script or style is left untouched.
 */
export function stripScriptsAndStyles(html: string): string {
  return html.replace(COMMENT_OR_RAW_TEXT, (match, tag: string | undefined) =>
    tag === undefined ? match : ''
  )
}

/** gzip of the HTML, as stored in page_snapshots.html_gzip */
export async function compressSnapshotHtml(html: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await gzipAsync(html))
}

export async function decompressSnapshotHtml(data: Uint8Array): Promise<string> {
  const html = await gunzipAsync(data, { maxOutputLength: MAX_DECOMPRESSED_BYTES })
  return html.toString('utf8')
}
