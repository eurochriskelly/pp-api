// Utility to generate unique initials from category names
class InitialGenerator {
  constructor() {
    this.usedInitials = new Set();
    this.singleLetterDisambiguationChar = 'A';
  }

  generateInitial(categoryName) {
    if (!categoryName) return 'N/A';
    const tokens = categoryName.split(/[\s-_]+/);
    let initial = '';
    for (const token of tokens) {
      if (/^\d+$/.test(token)) {
        initial += token;
      } else if (token.length > 0) {
        initial += token.charAt(0);
      }
    }
    return initial.toUpperCase().substring(0, 3);
  }

  resolveConflict(categoryName, initial, logger) {
    if (!this.usedInitials.has(initial)) {
      this.usedInitials.add(initial);
      return initial;
    }

    logger(`Initial conflict for category "${categoryName}": initial "${initial}" already used.`);
    const tokens = categoryName.split(/[\s-_]+/).filter(t => !/^\d+$/.test(t));
    const isSingleWord = tokens.length === 1;

    if (initial.length === 1 && isSingleWord) {
      return this.resolveSingleLetterConflict(categoryName, initial, logger);
    }
    return this.resolveGeneralConflict(categoryName, initial, logger);
  }

  resolveSingleLetterConflict(categoryName, initial, logger) {
    let attemptChar = this.singleLetterDisambiguationChar;
    while (attemptChar <= 'Z') {
      if (!this.usedInitials.has(attemptChar)) {
        this.usedInitials.add(attemptChar);
        this.singleLetterDisambiguationChar = String.fromCharCode(attemptChar.charCodeAt(0) + 1);
        logger(`Resolved conflict for "${categoryName}" (was "${initial}") to "${attemptChar}" using letter fallback.`);
        return attemptChar;
      }
      attemptChar = String.fromCharCode(attemptChar.charCodeAt(0) + 1);
    }

    logger(`Letter fallback exhausted for "${categoryName}". Trying numeric append to "${initial}".`);
    return this.appendNumeric(categoryName, initial, logger);
  }

  resolveGeneralConflict(categoryName, baseInitial, logger) {
    logger(`General conflict for "${categoryName}" (initial "${baseInitial}"). Using numeric append.`);
    return this.appendNumeric(categoryName, baseInitial, logger);
  }

  appendNumeric(categoryName, baseInitial, logger) {
    let count = 1;
    let tempInitial;
    do {
      const numStr = String(count++);
      const prefix = baseInitial.length + numStr.length > 3 
        ? baseInitial.substring(0, Math.max(0, 3 - numStr.length)) 
        : baseInitial;
      tempInitial = prefix.length === 0 ? numStr : prefix + numStr;
      tempInitial = tempInitial.substring(0, 3);
    } while (this.usedInitials.has(tempInitial) && count < 100);

    this.usedInitials.add(tempInitial);
    logger(`Resolved conflict for "${categoryName}" to "${tempInitial}" using numeric append.`);
    return tempInitial;
  }
}

module.exports = InitialGenerator;
