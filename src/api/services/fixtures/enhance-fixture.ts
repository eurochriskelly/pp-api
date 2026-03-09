// File: enhance-fixture.ts
import CategoryCompositionManager from './enhance-fixture/category-composition-manager';
import { FixtureLaneManager } from './enhance-fixture/fixture-lane-manager';
import { FixtureInfringementManager } from './enhance-fixture/fixture-infringement-manager';

export interface EnhanceFixtureDependencies {
  dbHelpers: {
    select: (sql: string, params: any[]) => Promise<any[]>;
  };
  loggers: {
    DD: (msg: string) => void;
  };
}

export interface EmbellishOptions {
  cardedPlayers?: boolean;
}

export interface Fixture {
  id: number;
  tournamentId: number;
  category: string;
  team1Id?: string;
  team1?: string;
  team2Id?: string;
  team2?: string;
  started?: Date | null;
  ended?: Date | null;
  scheduled?: Date | null;
  pitch?: string;
  umpireTeamId?: string;
  umpireTeam?: string;
  goals1?: number | null;
  goals2?: number | null;
  outcome?: string;
}

export interface LaneInfo {
  current: string;
  allowedLanes: string[];
}

export interface CompetitionInfo {
  offset: number;
  initials: string;
  matchId: string;
}

export interface Card {
  id: number;
  category: string;
  playerNumber: string;
  playerName: string;
  cardColor: string;
  team: string;
}

export interface Infringement {
  playerNumber: string;
  playerName: string;
  penalty: 'expulsion' | 'suspension';
}

export interface Infringements {
  team1: Infringement[];
  team2: Infringement[];
}

export interface EmbellishedFixture extends Fixture {
  team1: string;
  team2: string;
  lane: LaneInfo;
  competition: CompetitionInfo;
  umpireTeam: string | undefined;
  scheduledTime: string | null;
  startedTime: string | null;
  isResult: boolean;
  played: boolean;
  cards: Card[];
  infringements: Infringements;
  cardedPlayers?: Card[];
}

export default function enhanceFixtureFactory({
  dbHelpers,
  loggers,
}: EnhanceFixtureDependencies) {
  const { select } = dbHelpers;
  const { DD } = loggers;

  const categoryManager = new CategoryCompositionManager({
    select,
    logger: DD,
  });
  const laneManager = new FixtureLaneManager({ select, logger: DD });
  const infringementManager = new FixtureInfringementManager({
    select,
    logger: DD,
  });

  async function embellishFixture(
    fixture: Fixture | null,
    options: EmbellishOptions = {},
    categoryCompositions?: Map<string, { offset: number; initial: string }>
  ): Promise<EmbellishedFixture | null> {
    if (!fixture) return null;

    DD(`Calculating embellished fixture for fixture [${fixture.id}].`);
    const compositions =
      categoryCompositions ||
      (await categoryManager.getOrCalculate(fixture.tournamentId));
    const currentLane = await laneManager.getCurrentLane(fixture);
    const allowedLanes = await laneManager.getAllowedLanes(
      fixture,
      currentLane as any
    );
    const competitionData = compositions.get(fixture.category) || {
      offset: -1,
      initial: 'N/A',
    };

    let cards: Card[] = [];
    if (fixture.id && fixture.tournamentId) {
      DD(
        `Fetching card data for fixture [${fixture.id}], tournament [${fixture.tournamentId}].`
      );
      cards = await select(
        `SELECT id, category, playerNumber, playerName, cardColor, team FROM cards WHERE tournamentId = ? AND fixtureId = ?`,
        [fixture.tournamentId, fixture.id]
      );
      DD(`Found ${cards.length} cards for fixture [${fixture.id}].`);
    } else {
      DD(
        `Fixture ID or tournament ID missing for fixture (ID: ${fixture.id}, TID: ${fixture.tournamentId}), card data will be an empty array.`
      );
    }

    const baseEmbellished: EmbellishedFixture = {
      ...fixture,
      team1: fixture.team1Id || fixture.team1 || '',
      team2: fixture.team2Id || fixture.team2 || '',
      lane: { current: currentLane, allowedLanes },
      competition: {
        offset: competitionData.offset,
        initials: competitionData.initial,
        matchId: `${competitionData.initial}.${`${fixture.id}`.slice(-2)}`,
      },
      umpireTeam: fixture.umpireTeamId || fixture.umpireTeam,
      scheduledTime: fixture.scheduled
        ? fixture.scheduled.toTimeString().substring(0, 5)
        : null,
      startedTime: fixture.started
        ? fixture.started.toTimeString().substring(0, 5)
        : null,
      isResult: !!(fixture.goals1 === 0 || fixture.goals1),
      played: fixture.outcome !== 'not played' && !!fixture.ended,
      cards,
      infringements: { team1: [], team2: [] },
    };

    await infringementManager.processTeamInfringements(
      baseEmbellished as any,
      baseEmbellished.team1,
      baseEmbellished.infringements.team1
    );
    await infringementManager.processTeamInfringements(
      baseEmbellished as any,
      baseEmbellished.team2,
      baseEmbellished.infringements.team2
    );

    const finalEmbellished: EmbellishedFixture = {
      ...baseEmbellished,
      cardedPlayers: options.cardedPlayers ? baseEmbellished.cards : undefined,
    };

    return finalEmbellished;
  }

  return {
    embellishFixture,
    getOrCalculateTournamentCategoryCompositions:
      categoryManager.getOrCalculate.bind(categoryManager),
  };
}
