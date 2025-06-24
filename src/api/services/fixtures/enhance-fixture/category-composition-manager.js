// File: categoryCompositionManager.js
const InitialGenerator = require('./initial-generator');
const tournamentCategoryCompositionsCache = new Map();

// Manages category compositions for tournaments
class CategoryCompositionManager {
  constructor({ select, logger }) {
    this.select = select;
    this.logger = logger;
    this.initialGenerator = new InitialGenerator();
  }

  async calculateCategoryCompositions(tournamentId) {
    this.logger(
      `Calculating category compositions for tournament [${tournamentId}]`
    );
    const categories = await this.select(
      `SELECT DISTINCT category FROM fixtures WHERE tournamentId = ? ORDER BY category ASC`,
      [tournamentId]
    );

    const categoryMetadataMap = new Map();
    for (const [idx, catRow] of categories.entries()) {
      const categoryName = catRow.category;
      const initial = this.initialGenerator.generateInitial(categoryName);
      const resolvedInitial = this.initialGenerator.resolveConflict(
        categoryName,
        initial,
        this.logger
      );
      categoryMetadataMap.set(categoryName, {
        offset: idx,
        initial: resolvedInitial,
      });
      this.logger(
        `Category "${categoryName}": offset=${idx}, initial="${resolvedInitial}"`
      );
    }
    return categoryMetadataMap;
  }

  async getOrCalculate(tournamentId) {
    if (tournamentCategoryCompositionsCache.has(tournamentId)) {
      this.logger(
        `Using cached category compositions for tournament [${tournamentId}]`
      );
      return tournamentCategoryCompositionsCache.get(tournamentId);
    }
    const compositions = await this.calculateCategoryCompositions(tournamentId);
    tournamentCategoryCompositionsCache.set(tournamentId, compositions);
    return compositions;
  }
}

module.exports = CategoryCompositionManager;
