/**
 * Pure zero-dependency ZIP archive builder (STORE / method 0 + IEEE 802.3 CRC-32).
 * Designed for already-compressed binary payloads (PNG, WebP, JPEG).
 * Zero React, DOM, or Three.js runtime dependencies.
 */

export interface ZipArchiveEntry {
  filename: string;
  data: Uint8Array;
  modifiedAt?: Date;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

/**
 * Computes standard IEEE 802.3 CRC-32 checksum for a byte buffer.
 */
export function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeDosTimeDate(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
  return { dosTime, dosDate };
}

/**
 * Builds a deterministic uncompressed ZIP archive (`Uint8Array`) from named byte entries.
 * Deduplicates colliding filenames cleanly by appending `_2`, `_3`, etc.
 */
export function buildZipArchive(entries: ReadonlyArray<ZipArchiveEntry>): Uint8Array<ArrayBuffer> {
  const textEncoder = new TextEncoder();
  const usedNames = new Set<string>();
  const prepared: Array<{
    nameBytes: Uint8Array;
    data: Uint8Array;
    crc32: number;
    dosTime: number;
    dosDate: number;
    localHeaderOffset: number;
  }> = [];

  let localTotalSize = 0;
  let centralTotalSize = 0;

  for (const entry of entries) {
    let cleanName = entry.filename.replace(/^[/\\]+/, '') || 'file.bin';
    if (usedNames.has(cleanName)) {
      const dotIdx = cleanName.lastIndexOf('.');
      const base = dotIdx > 0 ? cleanName.slice(0, dotIdx) : cleanName;
      const ext = dotIdx > 0 ? cleanName.slice(dotIdx) : '';
      let suffix = 2;
      while (usedNames.has(`${base}_${suffix}${ext}`)) {
        suffix++;
      }
      cleanName = `${base}_${suffix}${ext}`;
    }
    usedNames.add(cleanName);

    const nameBytes = textEncoder.encode(cleanName);
    const { dosTime, dosDate } = encodeDosTimeDate(entry.modifiedAt ?? new Date(2026, 0, 1));
    const crc32 = computeCrc32(entry.data);

    prepared.push({
      nameBytes,
      data: entry.data,
      crc32,
      dosTime,
      dosDate,
      localHeaderOffset: localTotalSize,
    });

    localTotalSize += 30 + nameBytes.length + entry.data.length;
    centralTotalSize += 46 + nameBytes.length;
  }

  const totalSize = localTotalSize + centralTotalSize + 22;
  const buffer = new ArrayBuffer(totalSize);
  const out = new Uint8Array(buffer);
  const view = new DataView(buffer);

  let offset = 0;

  // 1. Local file headers + raw payloads
  for (const item of prepared) {
    view.setUint32(offset, 0x04034b50, true); // Local file header signature
    view.setUint16(offset + 4, 20, true); // Version needed to extract (2.0)
    view.setUint16(offset + 6, 0x0800, true); // UTF-8 filename flag
    view.setUint16(offset + 8, 0, true); // Compression method: 0 (STORE)
    view.setUint16(offset + 10, item.dosTime, true);
    view.setUint16(offset + 12, item.dosDate, true);
    view.setUint32(offset + 14, item.crc32, true);
    view.setUint32(offset + 18, item.data.length, true); // Compressed size
    view.setUint32(offset + 22, item.data.length, true); // Uncompressed size
    view.setUint16(offset + 26, item.nameBytes.length, true);
    view.setUint16(offset + 28, 0, true); // Extra field length
    out.set(item.nameBytes, offset + 30);
    offset += 30 + item.nameBytes.length;

    out.set(item.data, offset);
    offset += item.data.length;
  }

  const centralDirOffset = offset;

  // 2. Central directory file headers
  for (const item of prepared) {
    view.setUint32(offset, 0x02014b50, true); // Central directory signature
    view.setUint16(offset + 4, 20, true); // Version made by
    view.setUint16(offset + 6, 20, true); // Version needed
    view.setUint16(offset + 8, 0x0800, true); // UTF-8 filename flag
    view.setUint16(offset + 10, 0, true); // Compression method: 0 (STORE)
    view.setUint16(offset + 12, item.dosTime, true);
    view.setUint16(offset + 14, item.dosDate, true);
    view.setUint32(offset + 16, item.crc32, true);
    view.setUint32(offset + 20, item.data.length, true);
    view.setUint32(offset + 24, item.data.length, true);
    view.setUint16(offset + 28, item.nameBytes.length, true);
    view.setUint16(offset + 30, 0, true); // Extra length
    view.setUint16(offset + 32, 0, true); // Comment length
    view.setUint16(offset + 34, 0, true); // Disk number start
    view.setUint16(offset + 36, 0, true); // Internal attributes
    view.setUint32(offset + 38, 0, true); // External attributes
    view.setUint32(offset + 42, item.localHeaderOffset, true);
    out.set(item.nameBytes, offset + 46);
    offset += 46 + item.nameBytes.length;
  }

  // 3. End of central directory record (EOCD)
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 4, 0, true); // Disk number
  view.setUint16(offset + 6, 0, true); // Start disk
  view.setUint16(offset + 8, prepared.length, true);
  view.setUint16(offset + 10, prepared.length, true);
  view.setUint32(offset + 12, centralTotalSize, true);
  view.setUint32(offset + 16, centralDirOffset, true);
  view.setUint16(offset + 20, 0, true); // ZIP comment length

  return out;
}
