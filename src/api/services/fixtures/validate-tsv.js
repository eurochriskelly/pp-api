/*
 * validate-tsv.js – fixture-list validator (CommonJS, v4 · Jun 2025)
 *
 * ➤ Accepts a base-64 encoded TSV schedule string.
 * ➤ Returns { rows, warnings } where each cell is { value, warnings[] }.
 * ➤ Field-level validation + cross-checks.
 * ➤ Options (constructor 2nd arg):
 *   - restGapMultiplier: gap ≥ N × previous match duration (default 2, 0 = disabled)
 *   - checkBracketCompleteness: enable FIN/SF/QF consistency (default false)
 *
 * Usage (require-style):
 * const TSVValidator = require('./validate-tsv');
 * const fs = require('fs');
 * const b64 = Buffer.from(fs.readFileSync('schedule.tsv', 'utf8')).toString('base64');
 * const { rows, warnings } = new TSVValidator(b64, { restGapMultiplier: 1 }).validate();
 */

/* —— helpers —— */
function* idGen() {
  let i = 0;
  while (true) yield ++i;
}
const warnId = idGen();
const warn = (type, message, row = null, column = null) => ({
  id: warnId.next().value,
  type,
  message,
  ...(row !== null ? { row } : {}),
  ...(column !== null ? { column } : {}),
});

/* —— main class —— */
class TSVValidator {
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

  constructor(b64, options = {}) {
    this.opts = {
      restGapMultiplier: 2,
      checkBracketCompleteness: false,
      expectedTeams: null, // Map: cat -> group -> Set<team>
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

    // For pre-scanning results
    this.preScannedCatGroupTeams = new Map(); // Stores Map<category, Map<groupNumber, Set<teamName>>>
    this.preScannedCatGroups = new Map();
    this.preScannedCatBrackets = new Map();
    this.preScannedCatMatches = new Map();
  }

  /* —— pre-scan all rows for context —— */
  _preScanRows() {
    const categoryHdrIdx = this.hdx.get('CATEGORY');
    const stageHdrIdx = this.hdx.get('STAGE');
    const matchHdrIdx = this.hdx.get('MATCH');
    const team1HdrIdx = this.hdx.get('TEAM1');
    const team2HdrIdx = this.hdx.get('TEAM2');

    // If essential headers for pre-scan are missing, some validations might be incomplete.
    // _hdr() would have already warned about missing REQ headers.
    const essentialHeadersPresent =
      categoryHdrIdx !== undefined &&
      stageHdrIdx !== undefined &&
      matchHdrIdx !== undefined;
    // TEAM1 & TEAM2 are needed for preScannedCatGroupTeams

    for (let i = 1; i < this.lines.length; i++) {
      const cols = this.lines[i].split('\t');
      if (cols.every((c) => !c.trim())) continue; // skip blank lines

      if (!essentialHeadersPresent) continue; // Cannot reliably pre-scan without these headers

      const catVal = (cols[categoryHdrIdx] || '').trim().toUpperCase();
      if (!catVal) continue; // Skip if category is empty

      // Populate preScannedCatMatches
      const matchVal = (cols[matchHdrIdx] || '').trim().toUpperCase();
      const matchParts = /^([A-Z]+).?([0-9]+)$/.exec(matchVal);
      if (matchParts) {
        const matchId = `${matchParts[1]}.${Number(matchParts[2])}`;
        if (!this.preScannedCatMatches.has(catVal)) {
          this.preScannedCatMatches.set(catVal, new Map());
        }
        const catMatchMap = this.preScannedCatMatches.get(catVal);
        if (!catMatchMap.has(matchId)) {
          // Store first occurrence row index
          catMatchMap.set(matchId, i); // i is 1-based line index from this.lines
        }
      }

      // Populate preScannedCatGroups, preScannedCatBrackets, and preScannedCatGroupTeams
      let stageVal = (cols[stageHdrIdx] || '').trim().toUpperCase();
      if (stageVal === 'GPS' || stageVal === 'GP.*') {
        stageVal = 'GP.0';
      }
      const stageParts = stageVal.split(/[ .]/).filter(Boolean);

      if (stageParts.length === 2) {
        const [partA, partB] = stageParts;
        if (partA === 'GP' && /^\d+$/.test(partB)) {
          const groupNum = Number(partB);
          if (!this.preScannedCatGroups.has(catVal)) {
            this.preScannedCatGroups.set(catVal, new Set());
          }
          this.preScannedCatGroups.get(catVal).add(groupNum);

          // Populate preScannedCatGroupTeams
          if (team1HdrIdx !== undefined && team2HdrIdx !== undefined) {
            const team1Val = (cols[team1HdrIdx] || '').trim().toUpperCase();
            const team2Val = (cols[team2HdrIdx] || '').trim().toUpperCase();

            if (!this.preScannedCatGroupTeams.has(catVal)) {
              this.preScannedCatGroupTeams.set(catVal, new Map());
            }
            const categoryGroupTeams = this.preScannedCatGroupTeams.get(catVal);
            if (!categoryGroupTeams.has(groupNum)) {
              categoryGroupTeams.set(groupNum, new Set());
            }
            const teamsInGroupSet = categoryGroupTeams.get(groupNum);
            if (team1Val && this._isRealTeam(team1Val))
              teamsInGroupSet.add(team1Val);
            if (team2Val && this._isRealTeam(team2Val))
              teamsInGroupSet.add(team2Val);
          }
        } else if (TSVValidator.KO_CODES.has(partB)) {
          if (!this.preScannedCatBrackets.has(catVal)) {
            this.preScannedCatBrackets.set(catVal, new Set());
          }
          this.preScannedCatBrackets.get(catVal).add(partA);
        }
      }
    }
  }

  /* public */
  validate() {
    if (!this._hdr()) return this._result();
    this._preScanRows(); // Pre-scan for context
    for (let i = 1; i < this.lines.length; i++) {
      const cols = this.lines[i].split('\t');
      if (cols.every((c) => !c.trim())) continue; // skip blank
      this.rows.push(this._row(cols, i));
    }
    this._cross();
    this._buildStagesSummary();
    return this._result();
  }

  /* —— header —— */
  _hdr() {
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
  _row(c, r) {
    const out = {};
    const put = (k, res) => {
      out[k] = res;
      if (res.__warn) this.warnings.push(res.__warn);
    };

    const cat = this._cat(c, r);
    put('CATEGORY', cat);
    const mt = this._match(c, r, cat.value);
    put('MATCH', mt);
    put('TIME', this._time(c, r));
    put('PITCH', this._pass('PITCH', c, r));
    const stg = this._stage(c, r, cat.value);
    put('STAGE', stg);
    put('TEAM1', this._team(c, r, 'TEAM1', cat.value, stg.value, mt.value));
    put('TEAM2', this._team(c, r, 'TEAM2', cat.value, stg.value, mt.value));
    put('UMPIRES', this._team(c, r, 'UMPIRES', cat.value, stg.value, mt.value, true));
    put('DURATION', this._dur(c, r));
    if (this.hdx.has('REFEREE'))
      put('REFEREE', this._pass('REFEREE', c, r, true));
    return out;
  }

  /* —— validators —— */
  _time(c, r) {
    const v = (c[this.hdx.get('TIME')] || '').trim();
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
      ? { value: v.toUpperCase(), warnings: [] }
      : this._fw('TIME', r, `Invalid "${v}"`, v);
  }

  _cat(c, r) {
    const v = (c[this.hdx.get('CATEGORY')] || '').trim().toUpperCase();
    return v ? { value: v, warnings: [] } : this._fw('CATEGORY', r, 'Empty', v);
  }

  _match(c, r, cat) {
    const v = (c[this.hdx.get('MATCH')] || '').trim().toUpperCase();
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
      const map = this.catMatches.get(cat);
      if (map.has(id)) {
        this.warnings.push(
          warn('integrity', `Duplicate match ${id} in ${cat}`, r, 'MATCH')
        );
      }
      map.set(id, r);
    }
    return { value: id, warnings: [] };
  }

  _stage(c, r, cat) {
    let raw = (c[this.hdx.get('STAGE')] || '').trim().toUpperCase();
    if (raw === 'GPS' || raw === 'GP.*') {
      raw = 'GP.0';
    }
    const p = raw.split(/[ .]/).filter(Boolean);
    if (p.length !== 2) return this._fw('STAGE', r, 'Need two parts', raw);
    const [a, b] = p;
    let norm;
    if (a === 'GP') {
      if (!/^\d+$/.test(b))
        return this._fw('STAGE', r, 'Group id must be numeric', raw);
      norm = `GP.${Number(b)}`;
      if (!this.catGroups.has(cat)) this.catGroups.set(cat, new Set());
      this.catGroups.get(cat).add(Number(b));
    } else {
      if (!TSVValidator.KO_CODES.has(b))
        return this._fw('STAGE', r, `Unknown KO code ${b}`, raw);
      norm = `${a}.${b}`;
      if (!this.catBrackets.has(cat)) this.catBrackets.set(cat, new Set());
      this.catBrackets.get(cat).add(a);
    }
    return { value: norm, warnings: [] };
  }

  _team(c, r, col, cat, stage, matchId, isUmp = false) {
    const raw = (c[this.hdx.get(col)] || '').trim();
    if (!raw) return this._fw(col, r, 'Empty', '', false); // Return empty string for empty input

    /* group stage – validate teams and umpires */
    if (stage?.startsWith('GP.')) {
      const group = parseInt(stage.split('.')[1], 10);
      const up = raw.toUpperCase();

      // Check if team/umpire is valid against expectedTeams (if provided)
      if (
        this.opts.expectedTeams?.has(cat) &&
        this.opts.expectedTeams.get(cat).has(group)
      ) {
        const validTeams = this.opts.expectedTeams.get(cat).get(group);
        if (!validTeams.has(up)) {
          return this._fw(
            col,
            r,
            `Invalid ${isUmp ? 'umpire' : 'team'} "${raw}" for ${cat} GP.${group}`,
            up
          );
        }
      }

      // Track team/umpire for completeness check
      if (!isUmp) {
        // Only track TEAM1 and TEAM2 for team counts
        if (!this.catTeams.has(cat)) this.catTeams.set(cat, new Map());
        const groupTeams = this.catTeams.get(cat).get(group) || new Set();
        groupTeams.add(up);
        this.catTeams.get(cat).set(group, groupTeams);
      }
      return { value: up, warnings: [] }; // Return uppercase value
    }

    /* knock-out tokens */
    const up = raw.toUpperCase();
    // Note: `tok` is used for WINNER/LOSER and BEST patterns.
    // NTH GP.X and general GP.X patterns use regex on `up`.

    // Check for WINNER/LOSER pattern
    const tok = up.split(/\s+/);
    if (['WINNER', 'LOSER'].includes(tok[0])) {
      if (tok.length < 2)
        return this._fw(col, r, 'WINNER/LOSER needs match id', up);
      const mid = tok[1];
      if (!/^[A-Z]+\.\d+$/.test(mid))
        return this._fw(col, r, `Bad match id ${mid}`, up);

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

    // Check for "NTH GP.X" pattern (e.g., "1ST GP.1", "4TH GP.2", "5TH GPS")
    const nthGpMatch =
      /^(\d+(?:ST|ND|RD|TH))\s+GP(?:S|\.\*|(?:\.(\d+)))$/i.exec(up);
    if (nthGpMatch) {
      const posText = nthGpMatch[1];
      const pos = parseInt(posText, 10);
      const groupNum =
        nthGpMatch[2] === undefined ? 0 : parseInt(nthGpMatch[2], 10);
      const normalizedValue = `${posText} GP.${groupNum}`;
      const cellSpecificWarnings = [];

      const categoryScannedTeamsInGroups =
        this.preScannedCatGroupTeams.get(cat);

      if (groupNum === 0) {
        // Overall group stage position (e.g., "7th Gps")
        const allTeams = new Set();
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
        // Position within a specific group (e.g., "3rd Gp.1")
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
            // Positions like "0TH" are invalid
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

    // Check for BEST pattern (e.g., "1ST BEST 3RD")
    if (tok.includes('BEST')) {
      const i = tok.indexOf('BEST');
      const before = tok[i - 1] || '1ST'; // tok is from up.split(/\s+/)
      const after = tok[i + 1];
      if (!after || !/^(\d+)(ST|ND|RD|TH)$/.test(after)) {
        return this._fw(col, r, 'BEST needs following pos', up);
      }
      if (!/^(\d+)(ST|ND|RD|TH)$/.test(before)) {
        return this._fw(col, r, 'BEST needs preceding pos', up);
      }
      return { value: up.replace(/\s+/g, ' '), warnings: [] }; // Already uppercase
    }

    const gpm = /GP\.(\d+)/.exec(up); // General check for other GP.X references
    if (gpm) {
      const g = parseInt(gpm[1], 10);
      const cellSpecificWarnings = [];
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
      // This path is taken if `up` contains GP.X but wasn't "NTH GP.X" or other specific patterns.
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

  _dur(c, r) {
    const v = (c[this.hdx.get('DURATION')] || '').trim();
    return /^\d+$/.test(v)
      ? { value: +v, warnings: [] } // Numeric, no uppercase needed
      : this._fw('DURATION', r, 'Non-numeric', v);
  }

  _pass(h, c, r, opt = false) {
    const v = (c[this.hdx.get(h)] || '').trim();
    const up = v.toUpperCase();
    if (!v && !opt) return this._fw(h, r, 'Empty', v);
    return { value: up, warnings: [] };
  }
  _fw(col, row, msg, value = '', hard = true) {
    const z = warn('field', `${col}: ${msg}`, row, col);
    if (hard) this.warnings.push(z);
    return { value, warnings: [z], __warn: hard ? null : z };
  }
  /* —— helpers —— */
  _min(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  _isRealTeam(v) {
    return !/^(WINNER|LOSER|BEST|GP\.)/.test(v.toUpperCase());
  }

  /* —— cross-checks —— */
  _cross() {
    /* round-robin completeness */
    for (const [cat, groups] of this.catGroups.entries()) {
      for (const g of groups) {
        const matches = this.rows.filter(
          (r) => r.CATEGORY.value === cat && r.STAGE.value === `GP.${g}`
        );
        const teams = new Set();
        matches.forEach((m) => {
          if (this._isRealTeam(m.TEAM1.value))
            teams.add(m.TEAM1.value.toUpperCase());
          if (this._isRealTeam(m.TEAM2.value))
            teams.add(m.TEAM2.value.toUpperCase());
        });
        const n = teams.size;

        // Check expected number of teams
        if (
          this.opts.expectedTeams?.has(cat) &&
          this.opts.expectedTeams.get(cat).has(g)
        ) {
          const expectedTeams = this.opts.expectedTeams.get(cat).get(g);
          if (n !== expectedTeams.size) {
            this.warnings.push(
              warn(
                'integrity',
                `Category ${cat} GP.${g}: expected ${expectedTeams.size} teams, found ${n}`
              )
            );
          }
          // Check for missing or extra teams
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

        // Check match count
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

    /* duplicate time+pitch */
    const timePitch = new Set();
    this.rows.forEach((r) => {
      const key = `${r.TIME.value}@${r.PITCH.value}`;
      if (timePitch.has(key)) {
        this.warnings.push(warn('integrity', `Two matches at ${key}`));
      }
      timePitch.add(key);
    });

    /* team concurrency (same time) */
    const teamTime = new Set();
    this.rows.forEach((r) => {
      const t = r.TIME.value;
      const cat = r.CATEGORY.value;
      [r.TEAM1, r.TEAM2].forEach((ent) => {
        const name = ent.value?.toUpperCase();
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

    /* pitch overlap (duration) */
    const byPitch = {};
    this.rows.forEach((r, idx) => {
      const s = this._min(r.TIME.value);
      const e = s + (r.DURATION.value || 0);
      const p = r.PITCH.value;
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

    /* match-reference chronology */
    const matchMinutes = new Map();
    this.rows.forEach((r) =>
      matchMinutes.set(r.MATCH.value, this._min(r.TIME.value))
    );
    this.rows.forEach((r, row) => {
      ['TEAM1', 'TEAM2', 'UMPIRES'].forEach((col) => {
        const val = r[col].value?.toUpperCase() || '';
        const m = /\b(?:WINNER|LOSER) ([A-Z]+\.\d+)/.exec(val);
        if (m) {
          const ref = m[1];
          const refT = matchMinutes.get(ref);
          if (refT !== undefined && this._min(r.TIME.value) <= refT) {
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

    /* bracket completeness (optional) */
    if (this.opts.checkBracketCompleteness) {
      for (const [cat, brs] of this.catBrackets.entries()) {
        for (const br of brs) {
          const has = (code) =>
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

    /* team rest window (configurable) */
    if (this.opts.restGapMultiplier > 0) {
      const sched = new Map(); // team → list of {s,d,row}
      this.rows.forEach((r, idx) => {
        const s = this._min(r.TIME.value);
        const d = r.DURATION.value || 0;
        const cat = r.CATEGORY.value;
        [r.TEAM1, r.TEAM2].forEach((ent) => {
          const name = ent.value?.toUpperCase();
          if (!name || !this._isRealTeam(name)) return;
          const key = `${cat}#${name}`;
          if (!sched.has(key)) sched.set(key, []);
          sched.get(key).push({ s, d, row: idx });
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

    /* playing/umpiring overlap (same team playing & umpiring) */
    const roleMap = new Map(); // key: time#team → { play, ump }
    this.rows.forEach((r, idx) => {
      const t = r.TIME.value;
      const cat = r.CATEGORY.value;
      const add = (team, role) => {
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
      add(r.TEAM1.value?.toUpperCase(), 'play');
      add(r.TEAM2.value?.toUpperCase(), 'play');
      add(r.UMPIRES.value?.toUpperCase(), 'ump');
    });
  }

  _shortenTeamName(name) {
    if (!name) return '';

    const shortenPart = (part) => {
      part = part.trim();
      if (part.length <= 6) return part;

      const words = part.split(' ');
      const lastWord = words.length > 1 ? words.pop() : '';
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

  _buildStagesSummary() {
    for (const row of this.rows) {
      const category = row.CATEGORY.value;
      const stage = row.STAGE.value;
      const matchId = row.MATCH.value;
      const team1 = this._shortenTeamName(row.TEAM1.value);
      const team2 = this._shortenTeamName(row.TEAM2.value);
      const umpires = row.UMPIRES.value;

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

    // Now calculate size and matchesCount for groups
    for (const category in this.stages) {
      const groupStage = this.stages[category]['Group Stage'];
      for (const groupName in groupStage) {
        const groupNum = parseInt(groupName.split('.')[1], 10);
        const teams = this.catTeams.get(category)?.get(groupNum) || new Set();
        groupStage[groupName].size = teams.size;
        groupStage[groupName].matchesCount = groupStage[groupName].matches.length;
      }
    }
  }

  /* —— result —— */
  _result() {
    return { rows: this.rows, warnings: this.warnings, stages: this.stages };
  }
}

module.exports = TSVValidator;
