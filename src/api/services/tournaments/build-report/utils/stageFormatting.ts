/**
 * Format and calculate information about tournament stages and brackets
 */

export function generateCategoryCode(categoryName: string): string {
  if (!categoryName) return '';

  // First uppercase letter of each word
  const letters = categoryName
    .split(/[\s-]+/) // split by space or hyphen
    .filter((word) => isNaN(parseInt(word, 10))) // filter out parts that are just numbers
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();

  // Any numbers in the category
  const numbers = (categoryName.match(/\d+/g) || []).join('');

  return letters + numbers;
}

export function generateMatchLabel(category: string, matchId: number): string {
  const categoryCode = generateCategoryCode(category);
  const matchNumber = String(matchId).slice(-2).padStart(2, '0');
  return `${categoryCode}.${matchNumber}`;
}

export function calcStage(stage: string, groupNumber: number): string {
  if (stage === 'group') {
    return `GP.${groupNumber}`;
  }
  {
    const spart = stage.split('_')[1];
    if (spart === 'eights') {
      return `EF${groupNumber}`;
    } else if (spart === 'quarters') {
      return `QF${groupNumber}`;
    } else if (spart === 'semis') {
      return `SF${groupNumber}`;
    } else if (spart === 'finals') {
      return `FIN`;
    } else if (spart === 'playoffs') {
      return `P/O`;
    } else if (spart === '3rd4th') {
      return `3/4`;
    } else if (spart === '4th5th') {
      return `4/5`;
    } else if (spart === '5th6th') {
      return `5/6`;
    } else if (spart === '6th7th') {
      return `6/7`;
    } else if (spart === '7th8th') {
      return `7/8`;
    } else if (spart === '8th9th') {
      return `8/9`;
    } else if (spart === '9th10th') {
      return `9/10`;
    } else if (spart === '10th11th') {
      return `10/11`;
    } else if (spart === '11th12th') {
      return `11/12`;
    } else if (spart === '12th13th') {
      return `12/13`;
    } else if (spart === '13th14th') {
      return `13/14`;
    } else {
      return stage;
    }
  }
}

export function getMatchStatus(
  outcome: string,
  score1: number | null,
  score2: number | null
): string {
  if (outcome === 'not played') return 'contender';
  if (score1 == null) return 'contender';
  if (score1 > score2!) return 'won';
  if (score2! > score1) return 'lost';
  if (score1 === score2) return 'draw';
  return 'contender';
}

export function calcBracket(stage: string): string {
  if (stage === 'group') return stage;
  const code = stage.split('_')[0];
  switch (code.toLowerCase()) {
    case 'plt':
      return 'Plate';
    case 'shd':
      return 'Shield';
    case 'cup':
      return 'Cup';
    case 'bwl':
      return 'Bowl';
    case 'spn':
      return 'Spoon';
    default:
      return 'Unknown';
  }
}

export default {
  calcStage,
  getMatchStatus,
  calcBracket,
  generateMatchLabel,
  generateCategoryCode,
};
