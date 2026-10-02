// Mock service for fixtures
import { II, DD } from '../../../lib/logging';

export interface MockFixture {
  id: number;
  tournamentId: number;
  team1: string;
  team2: string;
  scheduledTime: string;
  pitch: string;
  started: string | null;
  ended: string | null;
  goals1: number | null;
  points1: number | null;
  goals2: number | null;
  points2: number | null;
  outcome: string;
  category: string;
  stage: string;
  groupNumber: number;
  notes: string;
}

export interface CardData {
  id?: number;
  cardColor: string;
  team: string;
  playerNumber: string;
  playerName: string;
}

export interface TeamScore {
  goals: number;
  points: number;
}

export interface RescheduleData {
  operation?: string;
  targetPitch?: string;
  tournamentId: number;
  fixtureId: number;
  relativeFixtureId?: number;
  placement?: string;
}

export default function mockFixturesService() {
  II('Fixtures mock service initialized');

  let mockFixtures: MockFixture[] = [
    {
      id: 1,
      tournamentId: 1,
      team1: 'Mock Team A',
      team2: 'Mock Team B',
      scheduledTime: '10:00',
      pitch: 'Mock Pitch 1',
      started: null,
      ended: null,
      goals1: 0,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'not played',
      category: 'mens',
      stage: 'group',
      groupNumber: 1,
      notes: '',
    },
    {
      id: 2,
      tournamentId: 1,
      team1: 'Mock Team C',
      team2: 'Mock Team D',
      scheduledTime: '11:00',
      pitch: 'Mock Pitch 1',
      started: null,
      ended: null,
      goals1: 0,
      points1: 0,
      goals2: 0,
      points2: 0,
      outcome: 'not played',
      category: 'mens',
      stage: 'group',
      groupNumber: 1,
      notes: '',
    },
  ];

  interface MockCard extends CardData {
    id: number;
    fixtureId: number;
    tournamentId: number;
  }

  let mockCards: MockCard[] = [];
  let nextCardId = 1;

  return {
    updateCalculatedFixtures: async (
      tournamentId: number,
      fixtureId: number
    ) => {
      II(
        `Mock: updateCalculatedFixtures called for tournament [${tournamentId}], fixture [${fixtureId}]`
      );
      const fixture = mockFixtures.find(
        (f) => f.id === fixtureId && f.tournamentId === tournamentId
      );
      if (fixture) {
        fixture.notes = 'calculated mock update at ' + new Date().toISOString();
        DD(`Mock: Updated fixture: ${JSON.stringify(fixture)}`);
        return { ...fixture };
      }
      DD(
        `Mock: Fixture not found for updateCalculatedFixtures: tId=${tournamentId}, fId=${fixtureId}`
      );
      return null;
    },

    getFixtures: async (
      tournamentId: number,
      filters: {
        pitch?: string;
        category?: string;
        outcome?: string;
        order?: string;
      } = {}
    ) => {
      II(`Mock: getFixtures called for tournament [${tournamentId}]`);
      let result = mockFixtures.filter(
        (f) => f.tournamentId === Number(tournamentId)
      );
      if (filters.pitch && filters.pitch !== '*') {
        result = result.filter((f) => f.pitch === filters.pitch);
      }
      if (filters.category && filters.category !== '*') {
        result = result.filter((f) => f.category === filters.category);
      }
      if (filters.outcome && filters.outcome !== '*') {
        result = result.filter((f) => f.outcome === filters.outcome);
      }
      DD(`Mock: Returning ${result.length} fixtures`);
      return result.map((f) => ({ ...f }));
    },

    getFilteredFixtures: async (
      tournamentId: number,
      filters: {
        pitch?: string[];
        category?: string[];
        referee?: string;
        team?: string;
        order?: string;
      } = {}
    ) => {
      II(`Mock: getFilteredFixtures called for tournament [${tournamentId}]`);
      let result = mockFixtures.filter(
        (f) => f.tournamentId === Number(tournamentId)
      );
      if (filters.pitch && filters.pitch.length) {
        result = result.filter((f) =>
          filters
            .pitch!.map((p) => p.toLowerCase())
            .includes(f.pitch.toLowerCase())
        );
      }
      if (filters.category && filters.category.length) {
        result = result.filter((f) =>
          filters
            .category!.map((c) => c.toLowerCase())
            .includes(f.category.toLowerCase())
        );
      }
      DD(`Mock: Returning ${result.length} filtered fixtures`);
      return result.map((f) => ({ ...f }));
    },

    validateTsv: (tsvEncoded: string) => {
      II(
        `Mock: validateTsv called with encoded length [${tsvEncoded?.length ?? 0}]`
      );
      return {
        rows: [],
        warnings: [],
      };
    },

    getFixture: async (tournamentId: number, fixtureId: number) => {
      II(
        `Mock: getFixture called for tournament [${tournamentId}], fixture [${fixtureId}]`
      );
      const fixture = mockFixtures.find(
        (f) => f.id === fixtureId && f.tournamentId === tournamentId
      );
      DD(
        fixture
          ? `Mock: Found fixture: ${JSON.stringify(fixture)}`
          : `Mock: Fixture not found: tId=${tournamentId}, fId=${fixtureId}`
      );
      return fixture ? { ...fixture } : null;
    },

    getNextFixtures: async (tournamentId: number) => {
      II(`Mock: getNextFixtures called for tournament [${tournamentId}]`);
      const result = mockFixtures
        .filter((f) => f.tournamentId === tournamentId && !f.started)
        .sort((a, b) =>
          (a.scheduledTime || '').localeCompare(b.scheduledTime || '')
        );
      DD(`Mock: Found ${result.length} next fixtures`);
      return result;
    },

    rewindLatestFixture: async (tournamentId: number) => {
      II(`Mock: rewindLatestFixture called for tournament [${tournamentId}]`);
      const latestStarted = mockFixtures
        .filter((f) => f.tournamentId === tournamentId && f.started)
        .sort(
          (a, b) =>
            new Date(b.started!).getTime() - new Date(a.started!).getTime()
        )[0];

      if (latestStarted) {
        DD('Mock: Rewinding fixture: ' + JSON.stringify(latestStarted));
        latestStarted.started = null;
        latestStarted.ended = null;
        latestStarted.goals1 = 0;
        latestStarted.points1 = 0;
        latestStarted.goals2 = 0;
        latestStarted.points2 = 0;
        latestStarted.outcome = 'not played';
        return {
          id: latestStarted.id,
          category: latestStarted.category,
          stage: latestStarted.stage,
          message: 'Mock rewind successful',
        };
      }
      DD('Mock: No fixture found to rewind');
      return null;
    },

    startFixture: async (fixtureId: number) => {
      II(`Mock: startFixture called for fixture [${fixtureId}]`);
      const fixture = mockFixtures.find((f) => f.id === fixtureId);
      if (fixture) {
        fixture.started = new Date().toISOString();
        fixture.outcome = 'in-progress';
        DD('Mock: Started fixture: ' + JSON.stringify(fixture));
        return { started: fixture.started };
      }
      DD(`Mock: Fixture not found for startFixture: fId=${fixtureId}`);
      return null;
    },

    endFixture: async (fixtureId: number, outcome?: string) => {
      II(`Mock: endFixture called for fixture [${fixtureId}]`);
      const fixture = mockFixtures.find((f) => f.id === fixtureId);
      if (fixture && fixture.started) {
        fixture.ended = new Date().toISOString();
        fixture.outcome = outcome || 'skipped';
        DD('Mock: Ended fixture: ' + JSON.stringify(fixture));
        return { ended: fixture.ended };
      }
      DD(
        `Mock: Fixture not found or not started for endFixture: fId=${fixtureId}`
      );
      return null;
    },

    reschedule: async (data: RescheduleData) => {
      II(`Mock: reschedule called with data: ${JSON.stringify(data)}`);
      const fixture = mockFixtures.find(
        (f) => f.id === data.fixtureId && f.tournamentId === data.tournamentId
      );
      if (fixture) {
        fixture.pitch = data.targetPitch || fixture.pitch;
        fixture.scheduledTime =
          'Rescheduled Mock Time @ ' + new Date().toLocaleTimeString();
        DD('Mock: Rescheduled fixture: ' + JSON.stringify(fixture));
        return {
          message: 'Mock reschedule successful',
          fixtureId: fixture.id,
          newScheduled: fixture.scheduledTime,
          pitch: fixture.pitch,
        };
      }
      DD(
        `Mock: Fixture not found for reschedule: tId=${data.tournamentId}, fId=${data.fixtureId}`
      );
      return { message: 'Mock reschedule failed, fixture not found' };
    },

    updateScore: async (
      tournamentId: number,
      fixtureId: number,
      team1: TeamScore,
      team2: TeamScore,
      outcome: string
    ) => {
      II(
        `Mock: updateScore called for tId [${tournamentId}], fId [${fixtureId}] with outcome [${outcome}]`
      );
      DD(
        'Team1 score: ' +
          JSON.stringify(team1) +
          ' Team2 score: ' +
          JSON.stringify(team2)
      );
      const fixture = mockFixtures.find(
        (f) => f.id === fixtureId && f.tournamentId === tournamentId
      );
      if (fixture) {
        fixture.goals1 = team1.goals;
        fixture.points1 = team1.points;
        fixture.goals2 = team2.goals;
        fixture.points2 = team2.points;
        fixture.outcome = outcome || 'in-progress';
        if (!fixture.started) fixture.started = new Date().toISOString();
        if (!fixture.ended) fixture.ended = new Date().toISOString();
        DD('Mock: Updated score for fixture: ' + JSON.stringify(fixture));
        return { message: 'Mock score updated successfully', updated: true };
      }
      DD(
        `Mock: Fixture not found for updateScore: tId=${tournamentId}, fId=${fixtureId}`
      );
      return {
        message: 'Mock score update failed, fixture not found',
        updated: false,
      };
    },

    cardPlayers: async (
      tournamentId: number,
      fixtureId: number,
      cardData: CardData
    ) => {
      II(
        `Mock: cardPlayers called for tId [${tournamentId}], fId [${fixtureId}]`
      );
      DD('Card data: ' + JSON.stringify(cardData));
      const newCard: MockCard = {
        id: cardData.id || nextCardId++,
        fixtureId,
        tournamentId,
        ...cardData,
      };
      if (cardData.id) {
        mockCards = mockCards.filter((c) => c.id !== cardData.id);
      }
      mockCards.push(newCard);
      DD('Mock: Card added/updated: ' + JSON.stringify(newCard));
      return {
        cardAdded: !cardData.id,
        cardUpdated: !!cardData.id,
        cardId: newCard.id,
      };
    },

    getCardedPlayers: async (tournamentId: number, fixtureId?: number) => {
      II(
        `Mock: getCardedPlayers called for tournament [${tournamentId}], fixture [${fixtureId ?? 'all'}]`
      );
      const result = mockCards.filter(
        (c) =>
          c.tournamentId === tournamentId &&
          (fixtureId === undefined || c.fixtureId === fixtureId)
      );
      DD(`Mock: Found ${result.length} carded players`);
      return result;
    },

    deleteCard: async (
      tournamentId: number,
      fixtureId: number,
      cardId: number
    ) => {
      II(
        `Mock: deleteCard called for tId [${tournamentId}], fId [${fixtureId}], cardId [${cardId}]`
      );
      const initialLength = mockCards.length;
      mockCards = mockCards.filter(
        (c) =>
          !(
            c.id === cardId &&
            c.fixtureId === fixtureId &&
            c.tournamentId === tournamentId
          )
      );
      const cardDeleted = mockCards.length < initialLength;
      DD(
        cardDeleted
          ? `Mock: Card ${cardId} deleted.`
          : `Mock: Card ${cardId} not found.`
      );
      return { cardDeleted };
    },

    slack: async (..._args: any[]) => {
      throw new Error('Not implemented in mock');
    },

    copyFixtures: async (
      sourceTournamentId: number,
      targetTournamentId: number
    ) => {
      II(
        `Mock: copyFixtures from [${sourceTournamentId}] to [${targetTournamentId}]`
      );

      // Pretend both tournaments exist in mock context
      const sourceFixtures = mockFixtures.filter(
        (f) => f.tournamentId === sourceTournamentId
      );
      if (sourceFixtures.length === 0) {
        DD('Mock: No source fixtures found');
      }

      // Wipe target fixtures and cards
      mockFixtures = mockFixtures.filter(
        (f) => f.tournamentId !== targetTournamentId
      );
      mockCards = mockCards.filter(
        (c) => c.tournamentId !== targetTournamentId
      );

      const idMapping = new Map<number, number>();
      let nextFixtureId =
        mockFixtures.reduce((max, f) => Math.max(max, f.id), 0) + 1;

      for (const fixture of sourceFixtures) {
        const newId = nextFixtureId++;
        idMapping.set(fixture.id, newId);
        mockFixtures.push({
          ...fixture,
          id: newId,
          tournamentId: targetTournamentId,
        });
      }

      const sourceCards = mockCards.filter(
        (c) => c.tournamentId === sourceTournamentId
      );
      for (const card of sourceCards) {
        const newFixtureId = idMapping.get(card.fixtureId);
        if (newFixtureId) {
          mockCards.push({
            ...card,
            id: nextCardId++,
            tournamentId: targetTournamentId,
            fixtureId: newFixtureId,
          });
        }
      }

      const copiedFixtures = mockFixtures.filter(
        (f) => f.tournamentId === targetTournamentId
      );
      const copiedCards = mockCards.filter(
        (c) => c.tournamentId === targetTournamentId
      );

      return {
        copied: copiedFixtures.length,
        fixtures: copiedFixtures,
        cards: copiedCards,
      };
    },
  updateTemplateSetup: async (..._args: any[]) => ({ updatedFixtures: 0 }),
  updateFixtureDetails: async (..._args: any[]) => ({ updatedFixtures: 0 }),
  };
}

export type MockFixturesService = ReturnType<typeof mockFixturesService>;
