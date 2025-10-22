import * as fs from 'fs';
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const sharp = require('sharp');

// Types for PDF text content
interface Txt {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Types for parsed data
interface IntakeForm {
  eventUuid: string;
  clubId: number;
  clubName: string | null;
  teamFullName: string | null;
  event: string | null;
  startDate: string | null;
}

interface IntakePerson {
  peopleFullName?: string;
  peopleDateOfBirth?: string | null;
  peopleRole?: 'player' | 'manager' | 'chairman' | 'secretary' | '';
  externalId?: number | null;
}

interface ParsedData {
  intakeForm: IntakeForm;
  intakePeople: IntakePerson[];
  clubLogo: Buffer | null;
}

// Column band interface
interface ColumnBand {
  key: string;
  xMid: number;
  xMin: number;
  xMax: number;
}

// Helper function to extract text content from PDF
function linesFrom(items: any[], tolY: number = 2): Txt[][] {
  const sorted = items
    .map((item) => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      w: item.width,
      h: item.height,
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: Txt[][] = [];
  let currentLine: Txt[] = [];
  let currentY = sorted[0]?.y || 0;

  for (const item of sorted) {
    if (Math.abs(item.y - currentY) > tolY) {
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
      currentLine = [item];
      currentY = item.y;
    } else {
      currentLine.push(item);
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

// Find anchor value on same line or next line
function findAnchorValueRight(lines: Txt[][], rx: RegExp): string | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const anchorIndex = line.findIndex((txt) => rx.test(txt.str.toLowerCase()));

    if (anchorIndex !== -1) {
      const anchor = line[anchorIndex];
      // Check same line, right of anchor
      for (let j = anchorIndex + 1; j < line.length; j++) {
        const txt = line[j];
        if (txt.x > anchor.x + 5) {
          return line
            .slice(j)
            .map((t) => t.str)
            .join(' ')
            .trim();
        }
      }
      // Check next line
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (nextLine.length > 0 && nextLine[0].str.trim()) {
          return nextLine
            .map((t) => t.str)
            .join(' ')
            .trim();
        }
      }
    }
  }
  return null;
}

// Find value above Irish label (value on previous line)
function findValueAboveLabel(lines: Txt[][], labelRx: RegExp): string | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const labelFound = line.some((txt) => labelRx.test(txt.str.toLowerCase()));

    if (labelFound && i > 0) {
      // Look at previous lines for the value (may span multiple lines)
      let valueLines: string[] = [];
      for (let j = i - 1; j >= 0; j--) {
        const prevLine = lines[j];
        const lineText = prevLine
          .map((t) => t.str)
          .join(' ')
          .trim();
        if (lineText && !labelRx.test(lineText.toLowerCase())) {
          valueLines.unshift(lineText); // Add to beginning to maintain order
        } else if (valueLines.length > 0) {
          // Stop if we hit another label or empty content
          break;
        }
      }
      if (valueLines.length > 0) {
        return valueLines.join(' ');
      }
    }
  }
  return null;
}

// Detect column bands from header line
function detectBands(headerLine: Txt[]): ColumnBand[] {
  const bands: ColumnBand[] = [];
  const sortedTokens = headerLine.sort((a, b) => a.x - b.x);

  const columnMappings: Record<string, RegExp> = {
    peopleFullName: /^(name|full\s*name|player\s*name)$/i,
    peopleDateOfBirth: /^(dob|date\s*of\s*birth)$/i,
    peopleRole: /^(role|position)$/i,
    externalId: /^(external\s*id|number|no\.|#)$/i,
  };

  for (const token of sortedTokens) {
    const str = token.str.toLowerCase().trim();
    for (const [key, regex] of Object.entries(columnMappings)) {
      if (regex.test(str)) {
        bands.push({
          key,
          xMid: token.x + token.w / 2,
          xMin: token.x,
          xMax: token.x + token.w,
        });
        break;
      }
    }
  }

  return bands.sort((a, b) => a.xMid - b.xMid);
}

// Bucket tokens into bands
function bucketToBands(
  line: Txt[],
  bands: ColumnBand[]
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const token of line) {
    const tokenMid = token.x + token.w / 2;
    let closestBand: ColumnBand | null = null;
    let minDistance = Infinity;

    for (const band of bands) {
      const distance = Math.abs(tokenMid - band.xMid);
      if (
        distance < minDistance &&
        tokenMid >= band.xMin - 10 &&
        tokenMid <= band.xMax + 10
      ) {
        minDistance = distance;
        closestBand = band;
      }
    }

    if (closestBand) {
      if (!result[closestBand.key]) {
        result[closestBand.key] = '';
      }
      result[closestBand.key] +=
        (result[closestBand.key] ? ' ' : '') + token.str;
    }
  }

  return result;
}

// Normalize date
function normDate(s: string): string | null {
  if (!s) return null;
  const trimmed = s.trim();

  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Try DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const match = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return null;
}

// Normalize role
function normRole(
  s: string
): 'player' | 'manager' | 'chairman' | 'secretary' | '' {
  if (!s) return '';
  const lower = s.toLowerCase().trim();

  if (lower.startsWith('play')) return 'player';
  if (lower.startsWith('manag')) return 'manager';
  if (lower.startsWith('chair')) return 'chairman';
  if (lower.startsWith('secr')) return 'secretary';

  return '';
}

// Normalize external ID
function normExtId(s: string): number | null {
  if (!s) return null;
  const digits = s.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : null;
}

// Extract all text data for debugging
function extractAllTextData(lines: Txt[][]): Record<string, string> {
  const result: Record<string, string> = {};
  let counter = 0;

  for (let i = 0; i < Math.min(lines.length, 50); i++) {
    // Limit to first 50 lines
    const line = lines[i];
    const lineText = line
      .map((t) => t.str)
      .join(' ')
      .trim();
    if (lineText) {
      result[`line_${String(counter).padStart(2, '0')}`] = lineText;
      counter++;
    }
  }

  return result;
}

// Helper function to extract logo image from PDF
async function extractLogo(pdf: any): Promise<Buffer | null> {
  if (pdf.numPages === 0) return null;

  const page = await pdf.getPage(1); // First page
  const viewport = page.getViewport({ scale: 1 });
  const operatorList = await page.getOperatorList();

  const images: Array<{ img: any; x: number; y: number }> = [];

  // Simple transform tracking (only translate for now)
  let currentX = 0;
  let currentY = 0;

  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const fn = operatorList.fnArray[i];
    const args = operatorList.argsArray[i];

    if (fn === pdfjs.OPS.transform) {
      // Update transform (assume simple translate)
      currentX += args[4] || 0;
      currentY += args[5] || 0;
    } else if (fn === pdfjs.OPS.save) {
      // Push state (simplified)
    } else if (fn === pdfjs.OPS.restore) {
      // Pop state (simplified)
    } else if (fn === pdfjs.OPS.paintImageXObject) {
      const imgKey = args[0];
      const img = page.objs.get(imgKey);
      if (img && img.data && img.width && img.height) {
        images.push({ img, x: currentX, y: currentY });
      }
    }
  }

  if (images.length === 0) return null;

  // Log images for debugging
  console.log(
    'Found images:',
    images.map((img) => ({
      x: img.x,
      y: img.y,
      width: img.img.width,
      height: img.img.height,
    }))
  );

  // Sort images by y descending (top first), then x ascending (left first)
  images.sort((a, b) => b.y - a.y || a.x - b.x);

  // Take the second image (assuming first is not the logo)
  const topLeftImage = images[1] || images[0];

  // Convert to PNG
  const channels =
    topLeftImage.img.data.length /
    (topLeftImage.img.width * topLeftImage.img.height);
  try {
    const pngBuffer = await sharp(topLeftImage.img.data, {
      raw: {
        width: topLeftImage.img.width,
        height: topLeftImage.img.height,
        channels: Math.floor(channels),
      },
    })
      .png()
      .toBuffer();
    return pngBuffer;
  } catch (err) {
    console.error('Error converting image to PNG:', err);
    return null;
  }
}

// Main parsing function
export async function parseCoachPdfToJson(
  pdfPath: string,
  eventUuid: string,
  clubId: number
): Promise<ParsedData> {
  // Load PDF document
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjs.getDocument({ data }).promise;

  // Extract logo
  const clubLogo = await extractLogo(pdf);

  let allLines: Txt[][] = [];

  // Extract text from all pages
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageLines = linesFrom(textContent.items);
    allLines = allLines.concat(pageLines);
  }

  // Extract all text data for parsing
  const allTextData = extractAllTextData(allLines);

  // Parse header using specific line positions from debug data
  const intakeForm: IntakeForm = {
    eventUuid,
    clubId,
    clubName:
      allTextData.line_00 && allTextData.line_01
        ? `${allTextData.line_00} ${allTextData.line_01}`
        : null,
    teamFullName: allTextData.line_04 || null,
    event: allTextData.line_06 ? allTextData.line_06.split('   ')[0] : null,
    startDate: allTextData.line_06
      ? normDate(allTextData.line_06.split('   ')[1] || '')
      : null,
  };

  // Normalize header values
  if (intakeForm.clubName) {
    intakeForm.clubName = intakeForm.clubName.replace(/\s+/g, ' ').trim();
  }
  if (intakeForm.teamFullName) {
    intakeForm.teamFullName = intakeForm.teamFullName
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (intakeForm.event) {
    intakeForm.event = intakeForm.event.replace(/\s+/g, ' ').trim();
  }

  // Parse people data using specific format from debug data
  const intakePeople: IntakePerson[] = [];

  // Add chairman and secretary from line_02
  if (allTextData.line_02) {
    const parts = allTextData.line_02.split('   ');
    if (parts.length >= 2) {
      intakePeople.push({
        peopleFullName: parts[0].trim(),
        peopleRole: 'chairman',
      });
      intakePeople.push({
        peopleFullName: parts[1].trim(),
        peopleRole: 'secretary',
      });
    }
  }

  // Find players section (after "Imreoirí")
  let playersStartIndex = -1;
  for (let i = 0; i < Object.keys(allTextData).length; i++) {
    const lineKey = `line_${String(i).padStart(2, '0')}`;
    if (allTextData[lineKey]?.includes('Imreoirí')) {
      playersStartIndex = i + 2; // Skip "= ag tosú (Starting)" line
      break;
    }
  }

  // Parse players in pairs of lines
  if (playersStartIndex !== -1) {
    for (
      let i = playersStartIndex;
      i < Object.keys(allTextData).length;
      i += 2
    ) {
      const nameLineKey = `line_${String(i).padStart(2, '0')}`;
      const dataLineKey = `line_${String(i + 1).padStart(2, '0')}`;

      const nameLine = allTextData[nameLineKey];
      const dataLine = allTextData[dataLineKey];

      if (!nameLine || !dataLine || dataLine.includes('Bainisteoirí')) {
        break; // End of players section
      }

      // Parse names (first line: 2 player names)
      const nameParts = nameLine.split(/\s{2,}/).filter((p) => p.trim());

      // Parse data line: pattern is "DD/MM/YYYY ID name DD/MM/YYYY ID name"
      // Split by spaces and parse sequentially
      const dataTokens = dataLine.split(/\s+/).filter((t) => t.trim());
      const playersData: Array<{ dob: string; id: number; name: string }> = [];

      let k = 0;
      while (k < dataTokens.length) {
        // Expect date (DD/MM/YYYY)
        if (
          k + 2 < dataTokens.length &&
          /^\d{2}\/\d{2}\/\d{4}$/.test(dataTokens[k])
        ) {
          const dob = dataTokens[k];
          const id = parseInt(dataTokens[k + 1]);
          // Name starts at k+2 and continues until next date or end
          let nameParts: string[] = [];
          k += 2;
          while (
            k < dataTokens.length &&
            !/^\d{2}\/\d{2}\/\d{4}$/.test(dataTokens[k])
          ) {
            nameParts.push(dataTokens[k]);
            k++;
          }
          const name = nameParts.join(' ');
          playersData.push({ dob, id, name });
        } else {
          k++; // Skip unrecognized tokens
        }
      }

      // Process each player
      for (let j = 0; j < Math.min(nameParts.length, playersData.length); j++) {
        const playerData = playersData[j];
        const person: IntakePerson = {
          peopleFullName: playerData?.name || nameParts[j]?.trim(),
          peopleDateOfBirth: playerData ? normDate(playerData.dob) : null,
          peopleRole: 'player',
          externalId: playerData?.id || null,
        };

        if (person.peopleFullName) {
          intakePeople.push(person);
        }
      }
    }
  }

  // Find managers section (after "Bainisteoirí")
  let managersStartIndex = -1;
  for (let i = 0; i < Object.keys(allTextData).length; i++) {
    const lineKey = `line_${String(i).padStart(2, '0')}`;
    if (allTextData[lineKey]?.includes('Bainisteoirí')) {
      managersStartIndex = i + 1;
      break;
    }
  }

  // Parse managers (simpler format)
  if (managersStartIndex !== -1) {
    for (let i = managersStartIndex; i < Object.keys(allTextData).length; i++) {
      const lineKey = `line_${String(i).padStart(2, '0')}`;
      const line = allTextData[lineKey];

      if (
        !line ||
        line.includes('Duplicate lists') ||
        line.includes('Sínithe')
      ) {
        break; // End of managers section
      }

      // Manager format: "Name" on one line, "ID Name" on next
      const nextLineKey = `line_${String(i + 1).padStart(2, '0')}`;
      const nextLine = allTextData[nextLineKey];

      if (nextLine && /^\d+/.test(nextLine)) {
        // This is a manager data line
        const idMatch = nextLine.match(/^(\d+)\s+(.+)$/);
        if (idMatch) {
          intakePeople.push({
            peopleFullName: line.trim(),
            peopleRole: 'manager',
            externalId: parseInt(idMatch[1]),
          });
        }
        i++; // Skip the data line we just processed
      }
    }
  }

  return {
    intakeForm,
    intakePeople,
    clubLogo,
  };
}
