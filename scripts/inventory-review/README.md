# Mock inventory review

The isolated `?inventory=1` view reads the mock workbook snapshot in `src/inventory.mock.json`. The normal Compass planner and saved plans are unchanged. No auth or storage integration is used by this view.

All 1,745 source records retain their original fields, source row and provenance. `Other` and `Other / Review` normalize into a held review bucket. Source currency labels are unverified, no GBP quote is calculated, audience mapping is not inferred, Global never matches another region, and no preferred publisher or scalable budget plan is claimed.

Eight adapter tests: `node --test scripts/inventory-review/inventory-adapter.test.mjs`.

To reimport the original workbook, run `python scripts/inventory-review/import_inventory.py /path/to/workbook.xlsx /path/to/output` (requires openpyxl). Review the generated data and rename `inventory.private.json` to `src/inventory.mock.json` only after approval for publication. Source workbook is not included. The importer preserves workbook semantics, including its CPL one-unit costs, and flags those rows instead of treating them as campaign budgets. Review categories overlap. The CPM threshold is a cautious review trigger, not an asserted industry benchmark.
