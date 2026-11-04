/**
 * Turns a font file into the "typeface JSON" that three.js TextGeometry needs.
 *
 *   npm run font                      → Nunito Black (the default 3D text font)
 *   npm run font -- path/to/font.ttf  → any .ttf / .otf / .woff you like
 *
 * Output: public/fonts/nunito-black.typeface.json (or pass a second path).
 * Only basic Latin characters are kept, to keep the file small.
 * Same conversion as three.js's TTFLoader.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2] ?? path.join(root, 'node_modules/@fontsource/nunito/files/nunito-latin-900-normal.woff');
const output = process.argv[3] ?? path.join(root, 'public/fonts/nunito-black.typeface.json');

const data = fs.readFileSync(input);
const font = opentype.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
const round = Math.round;
const scale = 100000 / ((font.unitsPerEm || 2048) * 72);
const keep = (code) => (code >= 32 && code < 127) || [0x2019, 0x2018, 0x201c, 0x201d, 0x2014, 0x2013, 0x2022, 0x00b7, 0x2026].includes(code);

const glyphs = {};
const map = font.encoding.cmap.glyphIndexMap;
for (const code of Object.keys(map).map(Number)) {
  if (!keep(code)) continue;
  const glyph = font.glyphs.get(map[code]);
  const token = { ha: round(glyph.advanceWidth * scale), x_min: round(glyph.xMin * scale), x_max: round(glyph.xMax * scale), o: '' };
  for (const c of glyph.path.commands) {
    const type = c.type.toLowerCase() === 'c' ? 'b' : c.type.toLowerCase();
    token.o += `${type} `;
    if (c.x !== undefined && c.y !== undefined) token.o += `${round(c.x * scale)} ${round(c.y * scale)} `;
    if (c.x1 !== undefined && c.y1 !== undefined) token.o += `${round(c.x1 * scale)} ${round(c.y1 * scale)} `;
    if (c.x2 !== undefined && c.y2 !== undefined) token.o += `${round(c.x2 * scale)} ${round(c.y2 * scale)} `;
  }
  glyphs[String.fromCodePoint(code)] = token;
}

const json = {
  glyphs,
  familyName: font.getEnglishName('fullName'),
  ascender: round(font.ascender * scale),
  descender: round(font.descender * scale),
  underlinePosition: font.tables.post.underlinePosition,
  underlineThickness: font.tables.post.underlineThickness,
  boundingBox: { xMin: font.tables.head.xMin, xMax: font.tables.head.xMax, yMin: font.tables.head.yMin, yMax: font.tables.head.yMax },
  resolution: 1000,
  original_font_information: { fullName: font.getEnglishName('fullName'), license: font.getEnglishName('license') ?? '' },
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(json));
console.log(`Wrote ${path.relative(root, output)}: ${Object.keys(glyphs).length} glyphs from ${json.familyName}`);
