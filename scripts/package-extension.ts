/**
 * Build the extension and pack it into one zip file that can be shared (Drive, GitHub release).
 *
 *   npm run package:extension          ->  extension/cekkutip-extension-<version>.zip
 *
 * The zip holds the built extension at its top level. To install it, unzip it, open
 * chrome://extensions, turn on Developer mode, choose "Load unpacked", and pick the folder.
 * No zip library is used: the format is small, and the file is checked by unzipping it.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateRawSync } from 'node:zlib'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = path.join(root, 'extension/dist')

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

function collect(dir: string, base = dir): ZipEntry[] {
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

// Run only when called as a script, so the functions above can be imported by a test.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  execFileSync('npx', ['tsx', 'scripts/build-extension.ts'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  })
  const version = (
    JSON.parse(readFileSync(path.join(dist, 'manifest.json'), 'utf8')) as { version: string }
  ).version
  const files = collect(dist)
  const target = path.join(root, `extension/cekkutip-extension-${version}.zip`)
  writeFileSync(target, writeZip(files))
  console.log(`packed ${files.length} files: ${target}`)
}
