const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const UTF16_LE_BOM = Buffer.from([0xff, 0xfe]);
const UTF16_BE_BOM = Buffer.from([0xfe, 0xff]);
const REPLACEMENT_CHAR = '\uFFFD';

const windows1252Decoder = new TextDecoder('windows-1252');
const utf16LeDecoder = new TextDecoder('utf-16le');
const utf16BeDecoder = new TextDecoder('utf-16be');

function scoreDecodedText(text: string): number {
  let score = 0;

  for (const char of text) {
    if (char === REPLACEMENT_CHAR) score += 10;
    if (char === '\u0000') score += 5;
  }

  return score;
}

function pickBestDecoding(candidates: string[]): string {
  return candidates.reduce((best, candidate) =>
    scoreDecodedText(candidate) < scoreDecodedText(best) ? candidate : best
  );
}

export default function decodeBase64Text(b64: string): string {
  const raw = Buffer.from(b64, 'base64');

  if (raw.length === 0) return '';

  if (raw.subarray(0, UTF8_BOM.length).equals(UTF8_BOM)) {
    return raw.subarray(UTF8_BOM.length).toString('utf8');
  }

  if (raw.subarray(0, UTF16_LE_BOM.length).equals(UTF16_LE_BOM)) {
    return utf16LeDecoder.decode(raw.subarray(UTF16_LE_BOM.length));
  }

  if (raw.subarray(0, UTF16_BE_BOM.length).equals(UTF16_BE_BOM)) {
    return utf16BeDecoder.decode(raw.subarray(UTF16_BE_BOM.length));
  }

  const candidates = [raw.toString('utf8')];

  if (raw.includes(0)) {
    candidates.push(utf16LeDecoder.decode(raw), utf16BeDecoder.decode(raw));
  }

  if (candidates[0].includes(REPLACEMENT_CHAR)) {
    candidates.push(windows1252Decoder.decode(raw));
  }

  return pickBestDecoding(candidates);
}
