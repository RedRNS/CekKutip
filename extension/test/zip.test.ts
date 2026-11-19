import { describe, expect, it } from 'vitest'
import { crc32, readZip, writeZip } from '../../scripts/package-extension'

describe('the zip writer and reader behind the site download', () => {
  const entries = [
    { name: 'manifest.json', data: Buffer.from('{"name":"CekKutip"}\n') },
    {
      name: 'assets/font-abc.woff2',
      data: Buffer.from(Array.from({ length: 3000 }, (_, i) => i % 251)),
    },
    { name: 'empty.txt', data: Buffer.alloc(0) },
    { name: 'icons/uni-é.png', data: Buffer.from('png bytes') },
  ]

  it('reads back exactly what was written, in order', () => {
    const back = readZip(writeZip(entries))
    expect(back.map((e) => e.name)).toEqual(entries.map((e) => e.name))
    for (const [i, e] of back.entries()) expect(e.data.equals(entries[i]!.data)).toBe(true)
  })

  it('gives the same bytes for the same input, so a rebuild changes nothing', () => {
    expect(writeZip(entries).equals(writeZip(entries))).toBe(true)
  })

  it('starts with the zip signature, so a browser and an unzip tool recognise it', () => {
    expect(writeZip(entries).subarray(0, 4).toString('hex')).toBe('504b0304')
  })

  it('computes the standard CRC-32', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926)
  })

  it('refuses a file that is not a zip, and an entry that was damaged', () => {
    expect(() => readZip(Buffer.from('<!doctype html><title>CekKutip</title>'))).toThrow(
      /Not a zip/,
    )
    const zip = writeZip([{ name: 'a.txt', data: Buffer.from('hello hello hello hello') }])
    // Flip one byte of the stored checksum in the directory entry.
    const at = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])) + 16
    zip[at] = (zip[at]! + 1) & 0xff
    expect(() => readZip(zip)).toThrow(/checksum/)
  })
})
