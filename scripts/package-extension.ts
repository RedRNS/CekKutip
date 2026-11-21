/**
 * Build the extension and pack it into one zip file that can be shared.
 *
 *   npm run package:extension          ->  extension/cekkutip-extension-<version>.zip   (for Drive, a release)
 *   tsx scripts/package-extension.ts --site
 *                                      ->  apps/web/dist/downloads/cekkutip-extension.zip
 *
 * The second form runs at the end of every web build (apps/web `build` script), so the file the site
 * offers on its Extension page is always built from the same commit as the site itself. It is always
 * built for the address in site.config.ts, whatever CEKKUTIP_URL says, and it never touches
 * extension/dist.
 *
 * The zip holds the built extension at its top level. To install it, unzip it, open
 * chrome://extensions, turn on Developer mode, choose "Load unpacked", and pick the folder.
 * No zip library is used: the format is small, and tests read the file back with readZip.
 */
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateRawSync, inflateRawSync } from 'node:zlib'

const root = fileURLToPath(new URL('..', import.meta.url))

/** Where the site serves the file from (the web build output). The Extension page links to /downloads/... */
export const SITE_ZIP = 'apps/web/dist/downloads/cekkutip-extension.zip'

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of data) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  /** Path inside the zip, with forward slashes. */
  name: string
  data: Buffer
}

// A fixed date (2026-01-01 00:00) keeps the zip the same for the same input.
const DOS_TIME = 0
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1

export function writeZip(entries: ZipEntry[]): Buffer {
  const parts: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0

  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8')
    const packed = deflateRawSync(data)
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0x0800, 6) // flags: file names are UTF-8
    local.writeUInt16LE(8, 8) // method: deflate
    local.writeUInt16LE(DOS_TIME, 10)
    local.writeUInt16LE(DOS_DATE, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(packed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    local.writeUInt16LE(0, 28)
    parts.push(local, nameBytes, packed)

    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4) // version made by
    entry.writeUInt16LE(20, 6) // version needed
    entry.writeUInt16LE(0x0800, 8)
    entry.writeUInt16LE(8, 10)
    entry.writeUInt16LE(DOS_TIME, 12)
    entry.writeUInt16LE(DOS_DATE, 14)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(packed.length, 20)
    entry.writeUInt32LE(data.length, 24)
    entry.writeUInt16LE(nameBytes.length, 28)
    // extra, comment, disk, internal and external attributes stay 0
    entry.writeUInt32LE(offset, 42)
    central.push(entry, nameBytes)

    offset += local.length + nameBytes.length + packed.length
  }

  const centralBytes = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralBytes.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, centralBytes, end])
}

/**
 * Reads a zip back (stored or deflated entries, no zip64). Throws when the file is not a zip or an
 * entry does not match its checksum. Used by tests and by verify-production to check the download.
 */
export function readZip(zip: Buffer): ZipEntry[] {
  let end = -1
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      end = i
      break
    }
  }
  if (end < 0) throw new Error('Not a zip file: no end-of-directory record.')
  const count = zip.readUInt16LE(end + 10)
  let at = zip.readUInt32LE(end + 16)
  const out: ZipEntry[] = []
  for (let n = 0; n < count; n++) {
    if (zip.readUInt32LE(at) !== 0x02014b50) throw new Error('Broken zip: bad directory entry.')
    const method = zip.readUInt16LE(at + 10)
    const crc = zip.readUInt32LE(at + 16)
    const packedSize = zip.readUInt32LE(at + 20)
    const nameLength = zip.readUInt16LE(at + 28)
    const extraLength = zip.readUInt16LE(at + 30)
    const commentLength = zip.readUInt16LE(at + 32)
    const localAt = zip.readUInt32LE(at + 42)
    const name = zip.subarray(at + 46, at + 46 + nameLength).toString('utf8')
    if (zip.readUInt32LE(localAt) !== 0x04034b50) throw new Error(`Broken zip: bad entry ${name}.`)
    const dataAt = localAt + 30 + zip.readUInt16LE(localAt + 26) + zip.readUInt16LE(localAt + 28)
    const packed = zip.subarray(dataAt, dataAt + packedSize)
    if (method !== 0 && method !== 8) throw new Error(`Unsupported zip method ${method}: ${name}.`)
    const data = method === 8 ? inflateRawSync(packed) : Buffer.from(packed)
    if (crc32(data) !== crc) throw new Error(`Broken zip: checksum mismatch in ${name}.`)
    out.push({ name, data })
    at += 46 + nameLength + extraLength + commentLength
  }
  return out
}

export function collect(dir: string, base = dir): ZipEntry[] {
  const out: ZipEntry[] = []
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) out.push(...collect(full, base))
    else
      out.push({
        name: path.relative(base, full).split(path.sep).join('/'),
        data: readFileSync(full),
      })
  }
  return out
}

function build(outDir: string, forSite: boolean) {
  const env: Record<string, string | undefined> = { ...process.env, EXTENSION_OUT: outDir }
  // The file the site offers always points at the site itself.
  if (forSite) {
    delete env.CEKKUTIP_URL
    delete env.EXTENSION_TEST_ALL_SITES
  }
  // Node with the tsx loader, not npx: no shell, so the same call works on Windows and in the image.
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/build-extension.ts'], {
    cwd: root,
    stdio: 'inherit',
    env,
  })
}

// Run only when called as a script, so the functions above can be imported by a test.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const forSite = process.argv.includes('--site')
  const outDir = forSite
    ? mkdtempSync(path.join(tmpdir(), 'cekkutip-ext-'))
    : path.join(root, 'extension/dist')
  try {
    build(outDir, forSite)
    const manifest = JSON.parse(readFileSync(path.join(outDir, 'manifest.json'), 'utf8')) as {
      version: string
    }
    const files = collect(outDir)
    const target = forSite
      ? path.join(root, SITE_ZIP)
      : path.join(root, `extension/cekkutip-extension-${manifest.version}.zip`)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, writeZip(files))
    console.log(`packed ${files.length} files: ${target}`)
  } finally {
    if (forSite) rmSync(outDir, { recursive: true, force: true })
  }
}
