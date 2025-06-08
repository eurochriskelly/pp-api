/**
 * Format and calculate information about tournament stages and brackets
 */

function calcStage(stage, groupNumber) {
  if (stage === 'group') {
    return `GP.${groupNumber}`; // Group stage with group number
  } {
    const spart = stage.split('_')[1]; 
    // spart can be 'eights', 'quarters', 'semis', 'finals', 'playoffs', '3rd4th', '5th6th', etc.
    // If it's eights to finals, return as EFn, QFn, SFn, or just FIN where n is groupNumber
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
      return stage; // Return the original stage if no match
    }
  } 
}

function getMatchStatus(outcome, score1, score2) {
  if (outcome === 'not played') return 'contender';
  if (!score1) return 'contender'; 
  if (score1 > score2) return 'won';
  if (score2 > score1) return 'lost';
  if (score1 === score2) return 'draw';
}

function calcBracket(stage) {
  if (stage === 'group') return stage;
  const code = stage.split('_')[0];
  switch (code.toLowerCase()) { 
    case 'plt': return "Plate";
    case 'shd': return "Shield";
    case 'cup': return "Cup";
    case 'bwl': return "Bowl";
    case 'spn': return "Spoon";
    default: return 'Unknown';
  }
}

module.exports = {
  calcStage,
  getMatchStatus,
  calcBracket
};
