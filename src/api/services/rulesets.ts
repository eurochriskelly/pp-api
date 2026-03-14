import dbHelper = require('../../lib/db-helper');

interface Ruleset {
  id: number;
  name: string;
  description?: string | null;
  configVersion: string;
  config: any;
  createdAt?: string;
}

interface DbConnection {
  query: (
    sql: string,
    values: unknown[],
    callback: (err: Error | null, results: unknown) => void
  ) => void;
}

function rulesetsService(db: DbConnection) {
  const { select, insert, update } = dbHelper(db as any);

  const normalize = (row: any): Ruleset => ({
    ...row,
    config:
      typeof row.config === 'string'
        ? (() => {
            try {
              return JSON.parse(row.config);
            } catch {
              return row.config;
            }
          })()
        : row.config,
  });

  return {
    listRulesets: async (): Promise<Ruleset[]> => {
      const rows = await select(
        `SELECT id, name, description, configVersion, config, createdAt
         FROM rulesets
         ORDER BY id DESC`
      );
      return rows.map(normalize);
    },

    getRulesetById: async (id: number): Promise<Ruleset | null> => {
      const rows = await select(
        `SELECT id, name, description, configVersion, config, createdAt
         FROM rulesets
         WHERE id = ?`,
        [id]
      );
      return rows[0] ? normalize(rows[0]) : null;
    },

    createRuleset: async (data: Partial<Ruleset>): Promise<Ruleset> => {
      const id = await insert(
        `INSERT INTO rulesets (name, description, configVersion, config)
         VALUES (?, ?, ?, ?)`,
        [
          data.name,
          data.description || null,
          data.configVersion || '1.0',
          JSON.stringify(data.config),
        ]
      );

      return {
        id,
        name: data.name as string,
        description: data.description || null,
        configVersion: data.configVersion || '1.0',
        config: data.config,
      };
    },

    updateRuleset: async (id: number, data: Partial<Ruleset>) => {
      const fields: string[] = [];
      const params: any[] = [];

      if (data.name !== undefined) {
        fields.push('name = ?');
        params.push(data.name);
      }
      if (data.description !== undefined) {
        fields.push('description = ?');
        params.push(data.description);
      }
      if (data.configVersion !== undefined) {
        fields.push('configVersion = ?');
        params.push(data.configVersion);
      }
      if (data.config !== undefined) {
        fields.push('config = ?');
        params.push(JSON.stringify(data.config));
      }

      if (!fields.length) {
        return { id, message: 'No changes provided' };
      }

      params.push(id);
      const affected = await update(
        `UPDATE rulesets SET ${fields.join(', ')} WHERE id = ?`,
        params
      );
      if (affected === 0) {
        throw new Error('Ruleset not found');
      }

      return { id, ...data };
    },
  };
}

export = rulesetsService;
