import { II } from '../../../lib/logging';

interface MockRuleset {
  id: number;
  name: string;
  description: string | null;
  configVersion: string;
  config: any;
}

const rulesets: MockRuleset[] = [
  {
    id: 1,
    name: 'Default Football Rules',
    description: 'Default points and tie-breakers for football championships',
    configVersion: '1.0',
    config: {
      points: { win: 2, draw: 1, loss: 0 },
      tieBreakers: ['pointsDifference', 'pointsScored'],
    },
  },
];

let nextId = 2;

export default function mockRulesetsService() {
  II('Rulesets mock service initialized');

  return {
    listRulesets: async () => rulesets,

    getRulesetById: async (id: number) => {
      return rulesets.find((row) => row.id === id) || null;
    },

    createRuleset: async (data: Partial<MockRuleset>) => {
      const row: MockRuleset = {
        id: nextId++,
        name: data.name as string,
        description: data.description || null,
        configVersion: data.configVersion || '1.0',
        config: data.config,
      };
      rulesets.push(row);
      return row;
    },

    updateRuleset: async (id: number, data: Partial<MockRuleset>) => {
      const index = rulesets.findIndex((row) => row.id === id);
      if (index === -1) {
        throw new Error('Ruleset not found');
      }

      rulesets[index] = {
        ...rulesets[index],
        ...data,
      };

      return rulesets[index];
    },
  };
}
