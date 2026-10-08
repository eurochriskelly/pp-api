import { RefreshOptions } from '../fixtures/calculated-fixtures';

export default (_db?: any) => ({
  refresh: async (tournamentId: number, _options?: RefreshOptions) => ({
    tournamentId,
    changes: [],
    skippedFixtureIds: [],
  }),
});
