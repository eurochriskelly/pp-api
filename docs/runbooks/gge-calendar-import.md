# GGE calendar import

`scripts/import-gge-calendar.js` imports the reviewed public GGE calendar bundle into the local Docker `EuroTourno` database. It defaults to a dry run and only permits writes when both `--apply` and `--local-docker` are provided.

```sh
node scripts/import-gge-calendar.js
node scripts/import-gge-calendar.js --apply --local-docker
```

The default bundle is the sibling project path `../pp-coord-responsive/data-imports/gge-2026`. Supply `--bundle=/absolute/path/to/gge-2026` to use a different reviewed bundle.

## Stored data

- Club records are matched conservatively by name, country, and city. Unmatched clubs are added to `EuroTourno.clubs`; matching records retain their existing details. A GGE crest only fills an empty existing logo.
- Imported clubs are placed in the existing regional directory: Benelux, Central/East, Iberia, Iberia / Galicia, Nordics, North/West, North/West / Bretagne, or North/West / Non-FFG. The source's event region takes priority; country and then location provide the fallback. Four governing-body entries referenced by events are retained in the import crosswalk but hidden from the club directory.
- Source PNG crests are retained in `clubs.clubLogo`. The local import upgrades that column from `BLOB` to `MEDIUMBLOB`, because source crests can exceed 64 KiB.
- Every calendar event becomes a `tournaments` record. Original fields, including times, descriptions, flags, locations, and source IDs, are retained in `gge_import_events.payload`.
- Recurring fixture descriptions become Series and Championships. The importer currently recognizes a recurring fixture description as a competition when it appears at least twice. It derives a round number from `Round`, `Manche`, or `Journée` labels; otherwise it orders the series' distinct event dates. It creates no entrants because the feed identifies a host club but does not reliably supply all participating clubs.

The import owns these source-crosswalk tables: `gge_import_runs`, `gge_import_clubs`, `gge_import_series`, `gge_import_championships`, and `gge_import_events`. They preserve source IDs, run provenance, and raw normalized payloads, and make reruns idempotent. Do not delete them while retaining imported GGE data.

## Local import performed 8 October 2026

The first load of source snapshot `624ea7379ebd257cdb4b8f1e3279f7b8b76ab903b15d1bb4657d9cb2ff2d536c` produced:

| Result | Count |
| --- | ---: |
| Source clubs/organizations linked | 138 |
| New clubs | 87 |
| Existing clubs matched | 51 |
| Logos loaded | 53 |
| Calendar events/tournaments | 201 |
| Competition fixture events assigned to rounds | 85 |
| Series and championships created | 7 each |

The second apply skipped all 201 source events and created no additional records. Foreign-key validation found no orphaned event or club mapping, and every imported round has its required tournament competition record.

The regional pass placed all 134 club records in the directory: 11 Benelux, 34 Central/East, 24 Iberia, 9 Iberia / Galicia, 14 Nordics, 28 North/West, 7 North/West / Bretagne, and 1 North/West / Non-FFG. The API now presents subregions with ` / ` instead of its former `%` separator.

## Before any non-local import

Use a fresh reviewed bundle, inspect its manifest and issue list, dry-run against the intended schema, and take a database backup. Treat organizer identities, missing end dates, and the incomplete club association in the source feed as review items; the importer deliberately preserves that data instead of inventing attendees or entrants. The `--local-docker` guard must be replaced by a separately reviewed production migration process rather than bypassed.
