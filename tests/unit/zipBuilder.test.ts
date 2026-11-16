import { describe, expect, it } from 'vitest';
import { buildZipArchive, computeCrc32 } from '../../src/core/zipBuilder';

describe('zipBuilder (Zero-Dependency STORE ZIP & CRC-32)', () => {
  it('computes standard IEEE 802.3 CRC-32 for known ASCII vector', () => {
    const bytes = new TextEncoder().encode('123456789');
    expect(computeCrc32(bytes)).toBe(0xcbf43926);
    expect(computeCrc32(new Uint8Array(0))).toBe(0x00000000);
  });

  it('builds a valid uncompressed STORE ZIP archive with matching headers and payloads', () => {
    const fileA = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const fileB = new TextEncoder().encode('stageflow-frame-b');
    const zip = buildZipArchive([
      { filename: '01_intro.png', data: fileA },
      { filename: '02_hero.webp', data: fileB },
    ]);

    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

    // Local file header #1 signature
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    // Compression method = 0 (STORE)
    expect(view.getUint16(8, true)).toBe(0);
    // CRC-32 + size for fileA
    expect(view.getUint32(14, true)).toBe(computeCrc32(fileA));
    expect(view.getUint32(18, true)).toBe(fileA.length);
    expect(view.getUint32(22, true)).toBe(fileA.length);

    const nameLenA = view.getUint16(26, true);
    expect(new TextDecoder().decode(zip.slice(30, 30 + nameLenA))).toBe('01_intro.png');
    expect(zip.slice(30 + nameLenA, 30 + nameLenA + fileA.length)).toEqual(fileA);

    // End of central directory record at tail (last 22 bytes)
    const eocdOffset = zip.length - 22;
    expect(view.getUint32(eocdOffset, true)).toBe(0x06054b50);
    expect(view.getUint16(eocdOffset + 8, true)).toBe(2);
    expect(view.getUint16(eocdOffset + 10, true)).toBe(2);

    const cdOffset = view.getUint32(eocdOffset + 16, true);
    expect(view.getUint32(cdOffset, true)).toBe(0x02014b50);
  });

  it('deduplicates colliding entry filenames cleanly', () => {
    const zip = buildZipArchive([
      { filename: 'shot.png', data: new Uint8Array([1]) },
      { filename: 'shot.png', data: new Uint8Array([2]) },
      { filename: 'shot.png', data: new Uint8Array([3]) },
    ]);

    const decoded = new TextDecoder().decode(zip);
    expect(decoded).toContain('shot.png');
    expect(decoded).toContain('shot_2.png');
    expect(decoded).toContain('shot_3.png');
  });
});
