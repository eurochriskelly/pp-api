// File: categoryCompositionManager.ts
import { InitialGenerator } from './initial-generator';

const tournamentCategoryCompositionsCache = new Map<
  number,
  Map<string, CategoryMetadata>
>();

export interface CategoryMetadata {
  offset: number;
  initial: string;
}

export interface CategoryCompositionManagerDependencies {
  select: (sql: string, params: any[]) => Promise<any[]>;
  logger: (msg: string) => void;
}

// Manages category compositions for tournaments
export class CategoryCompositionManager {
  private select: (sql: string, params: any[]) => Promise<any[]>;
  private logger: (msg: string) => void;
  private initialGenerator: InitialGenerator;

  constructor({ select, logger }: CategoryCompositionManagerDependencies) {
    this.select = select;
    this.logger = logger;
    this.initialGenerator = new InitialGenerator();
  }

  async calculateCategoryCompositions(
    tournamentId: number
  ): Promise<Map<string, CategoryMetadata>> {
    this.logger(
      `Calculating category compositions for tournament [${tournamentId}]`
    );
    const categories = await this.select(
      `SELECT DISTINCT category FROM fixtures WHERE tournamentId = ? ORDER BY category ASC`,
      [tournamentId]
    );

    const categoryMetadataMap = new Map<string, CategoryMetadata>();
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

  async getOrCalculate(
    tournamentId: number
  ): Promise<Map<string, CategoryMetadata>> {
    if (tournamentCategoryCompositionsCache.has(tournamentId)) {
      this.logger(
        `Using cached category compositions for tournament [${tournamentId}]`
      );
      return tournamentCategoryCompositionsCache.get(tournamentId)!;
    }
    const compositions = await this.calculateCategoryCompositions(tournamentId);
    tournamentCategoryCompositionsCache.set(tournamentId, compositions);
    return compositions;
  }
}

export default CategoryCompositionManager;
