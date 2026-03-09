/**
 * validate-tsv.ts – fixture-list validator (TypeScript, v4 · Jun 2025)
 *
 * Accepts a base-64 encoded TSV schedule string.
 * Returns { rows, warnings } where each cell is { value, warnings[] }.
 * Field-level validation + cross-checks.
 * Options (constructor 2nd arg):
 *   - restGapMultiplier: gap ≥ N × previous match duration (default 2, 0 = disabled)
 *   - checkBracketCompleteness: enable FIN/SF/QF consistency (default false)
 */

export interface TSVValidatorOptions {
  restGapMultiplier?: number;
  checkBracketCompleteness?: boolean;
  expectedTeams?: Map<string, Map<number, Set<string>>> | null;
}

export interface CellResult {
  value: string | number;
  warnings: Warning[];
  __warn?: Warning | null;
}

export interface Warning {
  id: number;
  type: string;
  message: string;
  row?: number;
  column?: string;
}

export interface RowData {
  [key: string]: CellResult;
}

export interface ValidationResult {
  rows: RowData[];
  warnings: Warning[];
  stages: StageSummary;
}

export interface StageSummary {
  [category: string]: {
    'Group Stage': {
      [groupName: string]: {
        size: number;
        matchesCount: number;
        matches: string[];
      };
    };
    'Knockout Stage': {
      [bracket: string]: {
        matches: string[];
      };
    };
  };
}

function* idGen(): Generator<number, never, unknown> {
  let i = 0;
  while (true) yield ++i;
}

const warnId = idGen();

const warn = (
  type: string,
  message: string,
  row: number | null = null,
  column: string | null = null
): Warning => ({
  id: warnId.next().value,
  type,
  message,
  ...(row !== null ? { row } : {}),
  ...(column !== null ? { column } : {}),
});

export class TSVValidator {
  static REQ = [
    'TIME',
    'MATCH',
    'CATEGORY',
    'PITCH',
    'TEAM1',
    'STAGE',
    'TEAM2',
    'UMPIRES',
    'DURATION',
  ];
  static OPT = ['REFEREE'];
  static KO_CODES = new Set([
    'FIN',
    'SF1',
    'SF2',
    'QF1',
    'QF2',
    'QF3',
    'QF4',
    'EF1',
    'EF2',
    'EF3',
    'EF4',
    'EF5',
    'EF6',
    'EF7',
    'EF8',
    '3/4',
    '4/5',
    '5/6',
    '6/7',
    '7/8',
    '8/9',
    '9/10',
    '10/11',
    '11/12',
    '12/13',
    '13/14',
    'P/O',
  ]);

  private opts: Required<TSVValidatorOptions>;
  private raw: string;
  private lines: string[];
  rows: RowData[];
  warnings: Warning[];
  private catMatchLetter: Map<string, string>;
  private catGroups: Map<string, Set<number>>;
  private catBrackets: Map<string, Set<string>>;
  private catTeams: Map<string, Map<number, Set<string>>>;
  private catMatches: Map<string, Map<string, number>>;
  stages: StageSummary;
  private header: string[];
  private hdx: Map<string, number>;

  // For pre-scanning results
  private preScannedCatGroupTeams: Map<string, Map<number, Set<string>>>;
  private preScannedCatGroups: Map<string, Set<number>>;
  private preScannedCatBrackets: Map<string, Set<string>>;
  private preScannedCatMatches: Map<string, Map<string, number>>;
  private preScannedCatStages: Map<string, Map<string, string>>;

  constructor(b64: string, options: TSVValidatorOptions = {}) {
    this.opts = {
      restGapMultiplier: 2,
      checkBracketCompleteness: false,
      expectedTeams: null,
      ...options,
    };
    this.raw = Buffer.from(b64, 'base64').toString('utf8');
    this.lines = this.raw.split(/\r?\n/).filter((l) => l.trim().length);
    this.rows = [];
    this.warnings = [];
    this.catMatchLetter = new Map();
    this.catGroups = new Map();
    this.catBrackets = new Map();
    this.catTeams = new Map();
    this.catMatches = new Map();
    this.stages = {};
    this.header = [];
    this.hdx = new Map();

    this.preScannedCatGroupTeams = new Map();
    this.preScannedCatGroups = new Map();
    this.preScannedCatBrackets = new Map();
    this.preScannedCatMatches = new Map();
    this.preScannedCatStages = new Map();
  }

  /* —— pre-scan all rows for context —— */
  private _preScanRows(): void {
    const categoryHdrIdx = this.hdx.get('CATEGORY');
    const stageHdrIdx = this.hdx.get('STAGE');
    const matchHdrIdx = this.hdx.get('MATCH');
    const team1HdrIdx = this.hdx.get('TEAM1');
    const team2HdrIdx = this.hdx.get('TEAM2');

    const essentialHeadersPresent =
      categoryHdrIdx !== undefined &&
      stageHdrIdx !== undefined &&
      matchHdrIdx !== undefined;

    for (let i = 1; i < this.lines.length; i++) {
      const cols = this.lines[i].split('\t');
      if (cols.every((c) => !c.trim())) continue;

      if (!essentialHeadersPresent) continue;

      const catVal = (cols[categoryHdrIdx!] || '').trim().toUpperCase();
      if (!catVal) continue;

      const stageVal = (cols[stageHdrIdx!] || '').trim().toUpperCase();
      const matchVal = (cols[matchHdrIdx!] || '').trim().toUpperCase();
      const matchParts = /^([A-Z]+).?([0-9]+)$/.exec(matchVal);
      if (matchParts) {
        const matchId = `${matchParts[1]}.${Number(matchParts[2])}`;
        if (!this.preScannedCatMatches.has(catVal)) {
          this.preScannedCatMatches.set(catVal, new Map());
        }
        const catMatchMap = this.preScannedCatMatches.get(catVal)!;
        if (!catMatchMap.has(matchId)) {
          catMatchMap.set(matchId, i);
        }

        let normalizedStage = stageVal;
        if (normalizedStage === 'GPS' || normalizedStage === 'GP.*') {
          normalizedStage = 'GP.0';
        }
        const stageParts = normalizedStage.split(/[ .]/).filter(Boolean);
        if (stageParts.length === 2) {
          const [partA, partB] = stageParts;
          if (partA === 'GP' && /^\d+$/.test(partB)) {
            normalizedStage = `GP.${Number(partB)}`;
          } else if (TSVValidator.KO_CODES.has(partB)) {
            normalizedStage = `${partA}.${partB}`;
          }
          if (!this.preScannedCatStages.has(catVal)) {
            this.preScannedCatStages.set(catVal, new Map());
          }
          const catStageMap = this.preScannedCatStages.get(catVal)!;
          catStageMap.set(normalizedStage, matchId);
        }
      }

      const stageParts = stageVal.split(/[ .]/).filter(Boolean);

      if (stageParts.length === 2) {
        const [partA, partB] = stageParts;
        if (partA === 'GP' && /^\d+$/.test(partB)) {
          const groupNum = Number(partB);
          if (!this.preScannedCatGroups.has(catVal)) {
            this.preScannedCatGroups.set(catVal, new Set());
          }
          this.preScannedCatGroups.get(catVal)!.add(groupNum);

          if (team1HdrIdx !== undefined && team2HdrIdx !== undefined) {
            const team1Val = (cols[team1HdrIdx!] || '').trim().toUpperCase();
            const team2Val = (cols[team2HdrIdx!] || '').trim().toUpperCase();

            if (!this.preScannedCatGroupTeams.has(catVal)) {
              this.preScannedCatGroupTeams.set(catVal, new Map());
            }
            const categoryGroupTeams =
              this.preScannedCatGroupTeams.get(catVal)!;
            if (!categoryGroupTeams.has(groupNum)) {
              categoryGroupTeams.set(groupNum, new Set());
            }
            const teamsInGroupSet = categoryGroupTeams.get(groupNum)!;
            if (team1Val && this._isRealTeam(team1Val))
              teamsInGroupSet.add(team1Val);
            if (team2Val && this._isRealTeam(team2Val))
              teamsInGroupSet.add(team2Val);
          }
        } else if (TSVValidator.KO_CODES.has(partB)) {
          if (!this.preScannedCatBrackets.has(catVal)) {
            this.preScannedCatBrackets.set(catVal, new Set());
          }
          this.preScannedCatBrackets.get(catVal)!.add(partA);
        }
      }
    }
  }

  /* public */
  validate(): ValidationResult {
    if (!this._hdr()) return this._result();
    this._preScanRows();
    for (let i = 1; i < this.lines.length; i++) {
      const cols = this.lines[i].split('\t');
      if (cols.every((c) => !c.trim())) continue;
      this.rows.push(this._row(cols, i));
    }
    this._cross();
    this._buildStagesSummary();
    return this._result();
  }

  /* —— header —— */
  private _hdr(): boolean {
    if (!this.lines.length) {
      this.warnings.push(warn('integrity', 'Empty file'));
      return false;
    }
    const hdr = this.lines[0].split('\t').map((h) => h.trim().toUpperCase());
    const missing = TSVValidator.REQ.filter((h) => !hdr.includes(h));
    if (missing.length) {
      this.warnings.push(
        warn('integrity', `Missing header(s): ${missing.join(', ')}`)
      );
    }
    this.header = [
      ...TSVValidator.REQ,
      ...TSVValidator.OPT.filter((o) => hdr.includes(o)),
    ];
    this.hdx = new Map();
    hdr.forEach((h, i) => this.hdx.set(h, i));
    return true;
  }

  /* —— per-row —— */
  private _row(c: string[], r: number): RowData {
    const out: RowData = {};
    const put = (k: string, res: CellResult) => {
      out[k] = res;
      if (res.__warn) this.warnings.push(res.__warn);
    };

    const cat = this._cat(c, r);
    put('CATEGORY', cat);
    const mt = this._match(c, r, cat.value as string);
    put('MATCH', mt);
    put('TIME', this._time(c, r));
    put('PITCH', this._pass('PITCH', c, r));
    const stg = this._stage(c, r, cat.value as string);
    put('STAGE', stg);
    put(
      'TEAM1',
      this._team(
        c,
        r,
        'TEAM1',
        cat.value as string,
        stg.value as string,
        mt.value as string
      )
    );
    put(
      'TEAM2',
      this._team(
        c,
        r,
        'TEAM2',
        cat.value as string,
        stg.value as string,
        mt.value as string
      )
    );
    put(
      'UMPIRES',
      this._team(
        c,
        r,
        'UMPIRES',
        cat.value as string,
        stg.value as string,
        mt.value as string,
        true
      )
    );
    put('DURATION', this._dur(c, r));
    if (this.hdx.has('REFEREE'))
      put('REFEREE', this._pass('REFEREE', c, r, true));
    return out;
  }

  /* —— validators —— */
  private _time(c: string[], r: number): CellResult {
    const v = (c[this.hdx.get('TIME')!] || '').trim();
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
      ? { value: v.toUpperCase(), warnings: [] }
      : this._fw('TIME', r, `Invalid "${v}"`, v);
  }

  private _cat(c: string[], r: number): CellResult {
    const v = (c[this.hdx.get('CATEGORY')!] || '').trim().toUpperCase();
    return v ? { value: v, warnings: [] } : this._fw('CATEGORY', r, 'Empty', v);
  }

  private _match(c: string[], r: number, cat: string): CellResult {
    const v = (c[this.hdx.get('MATCH')!] || '').trim().toUpperCase();
    const m = /^([A-Z]+).?([0-9]+)$/.exec(v);
    if (!m) return this._fw('MATCH', r, `Bad id ${v}`, v);
    const id = `${m[1]}.${Number(m[2])}`;
    if (cat) {
      const prev = this.catMatchLetter.get(cat);
      if (prev && prev !== m[1]) {
        this.warnings.push(
          warn(
            'integrity',
            `Category ${cat} previously ↔ ${prev}; now ${m[1]}`,
            r,
            'MATCH'
          )
        );
      }
      this.catMatchLetter.set(cat, m[1]);
      if (!this.catMatches.has(cat)) this.catMatches.set(cat, new Map());
      const map = this.catMatches.get(cat)!;
      if (map.has(id)) {
        this.warnings.push(
          warn('integrity', `Duplicate match ${id} in ${cat}`, r, 'MATCH')
        );
      }
      map.set(id, r);
    }
    return { value: id, warnings: [] };
  }

  private _stage(c: string[], r: number, cat: string): CellResult {
    let raw = (c[this.hdx.get('STAGE')!] || '').trim().toUpperCase();
    if (raw === 'GPS' || raw === 'GP.*') {
      raw = 'GP.0';
    }
    const p = raw.split(/[ .]/).filter(Boolean);
    if (p.length !== 2) return this._fw('STAGE', r, 'Need two parts', raw);
    const [a, b] = p;
    let norm: string;
    if (a === 'GP') {
      if (!/^\d+$/.test(b))
        return this._fw('STAGE', r, 'Group id must be numeric', raw);
      norm = `GP.${Number(b)}`;
      if (!this.catGroups.has(cat)) this.catGroups.set(cat, new Set());
      this.catGroups.get(cat)!.add(Number(b));
    } else {
      if (!TSVValidator.KO_CODES.has(b))
        return this._fw('STAGE', r, `Unknown KO code ${b}`, raw);
      norm = `${a}.${b}`;
      if (!this.catBrackets.has(cat)) this.catBrackets.set(cat, new Set());
      this.catBrackets.get(cat)!.add(a);
    }
    return { value: norm, warnings: [] };
  }

  private _team(
    c: string[],
    r: number,
    col: string,
    cat: string,
    stage: string,
    matchId: string,
    isUmp = false
  ): CellResult {
    const raw = (c[this.hdx.get(col)!] || '').trim();
    if (!raw) return this._fw(col, r, 'Empty', '', false);

    if (stage?.startsWith('GP.')) {
      const group = parseInt(stage.split('.')[1], 10);
      const up = raw.toUpperCase();

      if (
        this.opts.expectedTeams?.has(cat) &&
        this.opts.expectedTeams.get(cat)!.has(group)
      ) {
        const validTeams = this.opts.expectedTeams.get(cat)!.get(group)!;
        if (!validTeams.has(up)) {
          return this._fw(
            col,
            r,
            `Invalid ${isUmp ? 'umpire' : 'team'} "${raw}" for ${cat} GP.${group}`,
            up
          );
        }
      }

      if (!isUmp) {
        if (!this.catTeams.has(cat)) this.catTeams.set(cat, new Map());
        const groupTeams = this.catTeams.get(cat)!.get(group) || new Set();
        groupTeams.add(up);
        this.catTeams.get(cat)!.set(group, groupTeams);
      }
      return { value: up, warnings: [] };
    }

    const up = raw.toUpperCase();
    const tok = up.split(/\s+/);
    if (['WINNER', 'LOSER'].includes(tok[0])) {
      if (tok.length < 2)
        return this._fw(col, r, 'WINNER/LOSER needs match reference', up);
      let mid = tok[1];

      if (/^[A-Z]+\.\d+$/.test(mid)) {
        // It's already a match ID
      } else if (/^[A-Z]+\.[A-Z0-9/]+$/i.test(mid)) {
        const stageMap = this.preScannedCatStages.get(cat) || new Map();
        const resolvedMatchId = stageMap.get(mid.toUpperCase());
        if (!resolvedMatchId) {
          const w = warn(
            'integrity',
            `Unknown stage ${mid} referenced in "${raw}"`,
            r,
            col
          );
          this.warnings.push(w);
          return { value: `${tok[0]} ${mid}`, warnings: [w] };
        }
        mid = resolvedMatchId;
      } else {
        return this._fw(col, r, `Bad match reference ${mid}`, up);
      }

      if (mid === matchId) {
        const w = warn(
          'integrity',
          `Match ${matchId} cannot reference itself in "${raw}"`,
          r,
          col
        );
        this.warnings.push(w);
        return { value: `${tok[0]} ${mid}`, warnings: [w] };
      }

      const preScannedMap = this.preScannedCatMatches.get(cat) || new Map();
      if (!preScannedMap.has(mid)) {
        const w = warn(
          'integrity',
          `Unknown match ${mid} referenced in "${raw}"`,
          r,
          col
        );
        this.warnings.push(w);
        return { value: `${tok[0]} ${mid}`, warnings: [w] };
      }
      return { value: `${tok[0]} ${mid}`, warnings: [] };
    }

    const nthGpMatch =
      /^(\d+(?:ST|ND|RD|TH))\s+GP(?:S|\.\*|(?:\.(\d+)))$/i.exec(up);
    if (nthGpMatch) {
      const posText = nthGpMatch[1];
      const pos = parseInt(posText, 10);
      const groupNum =
        nthGpMatch[2] === undefined ? 0 : parseInt(nthGpMatch[2], 10);
      const normalizedPosText = posText.replace(/(ST|ND|RD|TH)$/i, (s) =>
        s.toLowerCase()
      );
      const normalizedValue = `${normalizedPosText} GP.${groupNum}`;
      const cellSpecificWarnings: Warning[] = [];

      const categoryScannedTeamsInGroups =
        this.preScannedCatGroupTeams.get(cat);

      if (groupNum === 0) {
        const allTeams = new Set<string>();
        if (categoryScannedTeamsInGroups) {
          for (const teams of categoryScannedTeamsInGroups.values()) {
            for (const team of teams) {
              allTeams.add(team);
            }
          }
        }
        const totalTeamsInCat = allTeams.size;

        if (pos === 0) {
          const w = warn(
            'field',
            `Invalid position "0TH" in "${raw}". Positions must be 1st or higher.`,
            r,
            col
          );
          this.warnings.push(w);
          cellSpecificWarnings.push(w);
        } else if (pos > totalTeamsInCat) {
          const w = warn(
            'field',
            `Position ${pos} in "${raw}" is invalid; category ${cat} only has ${totalTeamsInCat} teams in total across all groups.`,
            r,
            col
          );
          this.warnings.push(w);
          cellSpecificWarnings.push(w);
        }
      } else {
        const categoryDeclaredGroups =
          this.preScannedCatGroups.get(cat) || new Set();

        if (!categoryDeclaredGroups.has(groupNum)) {
          const w = warn(
            'field',
            `Referenced group GP.${groupNum} in "${raw}" does not exist in category ${cat}.`,
            r,
            col
          );
          this.warnings.push(w);
          cellSpecificWarnings.push(w);
        } else {
          const teamsInGroupSet = categoryScannedTeamsInGroups
            ? categoryScannedTeamsInGroups.get(groupNum)
            : undefined;
          const numTeamsInGroup = teamsInGroupSet ? teamsInGroupSet.size : 0;

          if (pos === 0) {
            const w = warn(
              'field',
              `Invalid position "0TH" in "${raw}". Positions must be 1st or higher.`,
              r,
              col
            );
            this.warnings.push(w);
            cellSpecificWarnings.push(w);
          } else if (numTeamsInGroup === 0 && pos > 0) {
            const w = warn(
              'field',
              `Position ${pos} in ${cat} GP.${groupNum} ("${raw}") is invalid; group is declared but has no teams.`,
              r,
              col
            );
            this.warnings.push(w);
            cellSpecificWarnings.push(w);
          } else if (pos > numTeamsInGroup) {
            const w = warn(
              'field',
              `Position ${pos} in ${cat} GP.${groupNum} ("${raw}") is invalid; group only has ${numTeamsInGroup} teams.`,
              r,
              col
            );
            this.warnings.push(w);
            cellSpecificWarnings.push(w);
          }
        }
      }
      return {
        value: normalizedValue,
        warnings: cellSpecificWarnings.map((w) => ({ ...w })),
      };
    }

    if (tok.includes('BEST')) {
      const i = tok.indexOf('BEST');
      const before = tok[i - 1] || '1ST';
      const after = tok[i + 1];
      if (!after || !/^(\d+)(ST|ND|RD|TH)$/.test(after)) {
        return this._fw(col, r, 'BEST needs following pos', up);
      }
      if (!/^(\d+)(ST|ND|RD|TH)$/.test(before)) {
        return this._fw(col, r, 'BEST needs preceding pos', up);
      }
      const normalized = up.replace(
        /(\d+)(ST|ND|RD|TH)/g,
        (_, num, suffix) => num + suffix.toLowerCase()
      );
      return { value: normalized.replace(/\s+/g, ' '), warnings: [] };
    }

    const gpm = /GP\.(\d+)/.exec(up);
    if (gpm) {
      const g = parseInt(gpm[1], 10);
      const cellSpecificWarnings: Warning[] = [];
      const preScannedSet = this.preScannedCatGroups.get(cat) || new Set();
      if (!preScannedSet.has(g)) {
        const w = warn(
          'field',
          `Unknown group GP.${g} referenced in "${raw}" for category ${cat}.`,
          r,
          col
        );
        this.warnings.push(w);
        cellSpecificWarnings.push(w);
      }
      return {
        value: up,
        warnings: cellSpecificWarnings.map((w) => ({ ...w })),
      };
    }

    return this._fw(
      col,
      r,
      'Unrecognised token format for knock-out stage or umpire',
      up,
      false
    );
  }

  private _dur(c: string[], r: number): CellResult {
    const v = (c[this.hdx.get('DURATION')!] || '').trim();
    return /^\d+$/.test(v)
      ? { value: +v, warnings: [] }
      : this._fw('DURATION', r, 'Non-numeric', v);
  }

  private _pass(h: string, c: string[], r: number, opt = false): CellResult {
    const v = (c[this.hdx.get(h)!] || '').trim();
    const up = v.toUpperCase();
    if (!v && !opt) return this._fw(h, r, 'Empty', v);
    return { value: up, warnings: [] };
  }

  private _fw(
    col: string,
    row: number,
    msg: string,
    value = '',
    hard = true
  ): CellResult {
    const z = warn('field', `${col}: ${msg}`, row, col);
    if (hard) this.warnings.push(z);
    return { value, warnings: [z], __warn: hard ? null : z };
  }

  /* —— helpers —— */
  private _min(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  private _isRealTeam(v: string): boolean {
    return !/^(WINNER|LOSER|BEST|GP\.|\d+(?:ST|ND|RD|TH))/.test(
      v.toUpperCase()
    );
  }

  /* —— cross-checks —— */
  private _cross(): void {
    for (const [cat, groups] of this.catGroups.entries()) {
      for (const g of groups) {
        const matches = this.rows.filter(
          (r) => r.CATEGORY.value === cat && r.STAGE.value === `GP.${g}`
        );
        const teams = new Set<string>();
        matches.forEach((m) => {
          if (this._isRealTeam(m.TEAM1.value as string))
            teams.add((m.TEAM1.value as string).toUpperCase());
          if (this._isRealTeam(m.TEAM2.value as string))
            teams.add((m.TEAM2.value as string).toUpperCase());
        });
        const n = teams.size;

        if (
          this.opts.expectedTeams?.has(cat) &&
          this.opts.expectedTeams.get(cat)!.has(g)
        ) {
          const expectedTeams = this.opts.expectedTeams.get(cat)!.get(g)!;
          if (n !== expectedTeams.size) {
            this.warnings.push(
              warn(
                'integrity',
                `Category ${cat} GP.${g}: expected ${expectedTeams.size} teams, found ${n}`
              )
            );
          }
          for (const team of teams) {
            if (!expectedTeams.has(team)) {
              this.warnings.push(
                warn(
                  'integrity',
                  `Category ${cat} GP.${g}: unexpected team ${team}`
                )
              );
            }
          }
          for (const team of expectedTeams) {
            if (!teams.has(team)) {
              this.warnings.push(
                warn(
                  'integrity',
                  `Category ${cat} GP.${g}: missing expected team ${team}`
                )
              );
            }
          }
        }

        if (n >= 2) {
          const expected = (n * (n - 1)) / 2;
          if (matches.length !== expected) {
            this.warnings.push(
              warn(
                'integrity',
                `Category ${cat} GP.${g}: expected ${expected} matches for ${n} teams, found ${matches.length}`
              )
            );
          }
        }
      }
    }

    const timePitch = new Set<string>();
    this.rows.forEach((r) => {
      const key = `${r.TIME.value}@${r.PITCH.value}`;
      if (timePitch.has(key)) {
        this.warnings.push(warn('integrity', `Two matches at ${key}`));
      }
      timePitch.add(key);
    });

    const teamTime = new Set<string>();
    this.rows.forEach((r) => {
      const t = r.TIME.value as string;
      const cat = r.CATEGORY.value as string;
      [r.TEAM1, r.TEAM2].forEach((ent) => {
        const name = (ent.value as string)?.toUpperCase();
        if (!name || !this._isRealTeam(name)) return;
        const key = `${t}#${cat}#${name}`;
        if (teamTime.has(key)) {
          this.warnings.push(
            warn('integrity', `Team ${name} (${cat}) in two matches at ${t}`)
          );
        }
        teamTime.add(key);
      });
    });

    const byPitch: {
      [pitch: string]: Array<{ s: number; e: number; row: number }>;
    } = {};
    this.rows.forEach((r, idx) => {
      const s = this._min(r.TIME.value as string);
      const e = s + ((r.DURATION.value as number) || 0);
      const p = r.PITCH.value as string;
      byPitch[p] ??= [];
      byPitch[p].push({ s, e, row: idx });
    });
    for (const [p, list] of Object.entries(byPitch)) {
      list.sort((a, b) => a.s - b.s);
      for (let i = 1; i < list.length; i++) {
        if (list[i].s < list[i - 1].e) {
          this.warnings.push(
            warn(
              'integrity',
              `Overlap on ${p}: rows ${list[i - 1].row} & ${list[i].row}`
            )
          );
        }
      }
    }

    const matchMinutes = new Map<string, number>();
    this.rows.forEach((r) =>
      matchMinutes.set(
        r.MATCH.value as string,
        this._min(r.TIME.value as string)
      )
    );
    this.rows.forEach((r, row) => {
      ['TEAM1', 'TEAM2', 'UMPIRES'].forEach((col) => {
        const val = (r[col].value as string)?.toUpperCase() || '';
        const m = /\b(?:WINNER|LOSER) ([A-Z]+\.\d+)/.exec(val);
        if (m) {
          const ref = m[1];
          const refT = matchMinutes.get(ref);
          if (refT !== undefined && this._min(r.TIME.value as string) <= refT) {
            this.warnings.push(
              warn(
                'integrity',
                `Row ${row}: ${col} references ${ref} scheduled later or same time`,
                row,
                col
              )
            );
          }
        }
      });
    });

    if (this.opts.checkBracketCompleteness) {
      for (const [cat, brs] of this.catBrackets.entries()) {
        for (const br of brs) {
          const has = (code: string) =>
            this.rows.some(
              (r) =>
                r.CATEGORY.value === cat && r.STAGE.value === `${br}.${code}`
            );
          const fin = has('FIN');
          const sf1 = has('SF1');
          const sf2 = has('SF2');
          const qfs = ['QF1', 'QF2', 'QF3', 'QF4'].filter(has);
          if (fin && !(sf1 && sf2)) {
            this.warnings.push(
              warn('misc', `${cat} ${br}: FIN without both SFs`)
            );
          }
          if ((sf1 || sf2) && qfs.length < 4) {
            this.warnings.push(
              warn(
                'misc',
                `${cat} ${br}: semis present but ${qfs.length} of 4 QFs`
              )
            );
          }
        }
      }
    }

    if (this.opts.restGapMultiplier > 0) {
      const sched = new Map<
        string,
        Array<{ s: number; d: number; row: number }>
      >();
      this.rows.forEach((r, idx) => {
        const s = this._min(r.TIME.value as string);
        const d = (r.DURATION.value as number) || 0;
        const cat = r.CATEGORY.value as string;
        [r.TEAM1, r.TEAM2].forEach((ent) => {
          const name = (ent.value as string)?.toUpperCase();
          if (!name || !this._isRealTeam(name)) return;
          const key = `${cat}#${name}`;
          if (!sched.has(key)) sched.set(key, []);
          sched.get(key)!.push({ s, d, row: idx });
        });
      });
      for (const [key, list] of sched.entries()) {
        const [cat, team] = key.split('#');
        list.sort((a, b) => a.s - b.s);
        for (let i = 1; i < list.length; i++) {
          const prev = list[i - 1];
          const cur = list[i];
          const minGap = prev.d * this.opts.restGapMultiplier;
          if (cur.s < prev.s + prev.d + minGap) {
            this.warnings.push(
              warn(
                'misc',
                `Team ${team} (${cat}) row ${cur.row}: rest gap ${cur.s - (prev.s + prev.d)} min (<${minGap})`
              )
            );
          }
        }
      }
    }

    const roleMap = new Map<string, { play: boolean; ump: boolean }>();
    this.rows.forEach((r, idx) => {
      const t = r.TIME.value as string;
      const cat = r.CATEGORY.value as string;
      const add = (team: string | undefined, role: 'play' | 'ump') => {
        if (!team || !this._isRealTeam(team)) return;
        const key = `${t}#${cat}#${team}`;
        const obj = roleMap.get(key) || { play: false, ump: false };
        obj[role] = true;
        if (obj.play && obj.ump) {
          this.warnings.push(
            warn(
              'integrity',
              `Team ${team} (${cat}) both playing and umpiring at ${t}`,
              idx
            )
          );
        }
        roleMap.set(key, obj);
      };
      add((r.TEAM1.value as string)?.toUpperCase(), 'play');
      add((r.TEAM2.value as string)?.toUpperCase(), 'play');
      add((r.UMPIRES.value as string)?.toUpperCase(), 'ump');
    });
  }

  private _shortenTeamName(
    name: string | null | undefined,
    shortenRealTeams = true
  ): string {
    if (!name) return '';

    if (!this._isRealTeam(name)) {
      if (name.startsWith('WINNER') || name.startsWith('LOSER')) {
        const firstWord = name.split(' ')[0];
        return (
          firstWord.charAt(0) +
          firstWord.substring(1).toLowerCase() +
          name.substring(firstWord.length)
        );
      }
      const m = /^(\d+)(ST|ND|RD|TH)(.*)/i.exec(name);
      if (m) {
        return m[1] + m[2].toLowerCase() + m[3];
      }
      return name;
    }

    if (!shortenRealTeams) {
      return name;
    }

    if (!name.includes('/')) {
      return name;
    }

    const shortenPart = (part: string): string => {
      part = part.trim();
      if (part.length <= 6) return part;

      const words = part.split(' ');
      const lastWord = words.length > 1 ? words.pop()! : '';
      const firstPart = words.join(' ');

      if (lastWord) {
        const available = 6 - (lastWord.length + 1);
        if (available < 1) return part.substring(0, 6);
        return `${firstPart.substring(0, available)} ${lastWord}`;
      } else {
        return firstPart.substring(0, 6);
      }
    };

    return name.split('/').map(shortenPart).join('/');
  }

  private _buildStagesSummary(): void {
    for (const row of this.rows) {
      const category = row.CATEGORY.value as string;
      const stage = row.STAGE.value as string;
      const matchId = row.MATCH.value as string;
      const team1 = this._shortenTeamName(row.TEAM1.value as string);
      const team2 = this._shortenTeamName(row.TEAM2.value as string);
      const umpires = this._shortenTeamName(row.UMPIRES.value as string, false);

      if (!this.stages[category]) {
        this.stages[category] = {
          'Group Stage': {},
          'Knockout Stage': {},
        };
      }

      const matchIdParts = matchId.split('.');
      const formattedMatchId = `${matchIdParts[0]}.${matchIdParts[1].padStart(
        2,
        ' '
      )}>`;

      const team1Display = `"${team1}"`.padEnd(26);
      const team2Display = `"${team2}"`.padEnd(26);
      const teamsPart = `${team1Display} vs ${team2Display}`;

      if (stage.startsWith('GP.')) {
        const groupName = `Gp.${stage.split('.')[1]}`;
        const groupStage = this.stages[category]['Group Stage'];
        if (!groupStage[groupName]) {
          groupStage[groupName] = {
            size: 0,
            matchesCount: 0,
            matches: [],
          };
        }
        const prefix = `${formattedMatchId} `.padEnd(13);
        const matchString = `${prefix}${teamsPart} Ump: "${umpires}"`;
        groupStage[groupName].matches.push(matchString);
      } else {
        const [bracket, stageCode] = stage.split('.');
        const knockoutStage = this.stages[category]['Knockout Stage'];
        if (!knockoutStage[bracket]) {
          knockoutStage[bracket] = {
            matches: [],
          };
        }
        const prefix = `${formattedMatchId} ${stageCode}: `.padEnd(13);
        const koMatchString = `${prefix}${teamsPart} Ump: "${umpires}"`;
        knockoutStage[bracket].matches.push(koMatchString);
      }
    }

    for (const category in this.stages) {
      const groupStage = this.stages[category]['Group Stage'];
      for (const groupName in groupStage) {
        const groupNum = parseInt(groupName.split('.')[1], 10);
        const teams = this.catTeams.get(category)?.get(groupNum) || new Set();
        groupStage[groupName].size = teams.size;
        groupStage[groupName].matchesCount =
          groupStage[groupName].matches.length;
      }
    }
  }

  /* —— result —— */
  private _result(): ValidationResult {
    return { rows: this.rows, warnings: this.warnings, stages: this.stages };
  }
}

export default TSVValidator;
