# Mock inventory review

The isolated `/data-review` (with `/data-review/` and legacy `?inventory=1` aliases) view reads the mock workbook snapshot in `src/inventory.mock.json`. The normal Compass planner and saved plans are unchanged. No auth or storage integration is used by this view.

All 1,745 source records (349 products x 5 markets, 11 tactics) keep their original fields, source row and provenance. Currency is USD only. Expected result and cost are recalculated at import from the 27 Nov brief (section 6); the workbook's cached results are kept only as `source_cached_result` and `source_cached_cost` for audit. Each record also carries `priority` (1 highest), six `audience_fit` flags and the row `selection_rationale`. Global never matches another region, and no preferred publisher or scalable budget plan is claimed. All data is mock and not validated.

Calculation: CPM cost = volume (5,000 if missing) / 1,000 x rate, delivery = volume. CPL cost = 100 x rate, delivery = 100 leads. Flat fee cost = package price. CTR delivery = volume x CTR. Impressions and Reach delivery = volume. Registrations, Listens, Clicks and flat-fee leads are package counts and are never multiplied by volume.

Adapter and data tests: `node --test scripts/inventory-review/inventory-adapter.test.mjs`.

To reimport the original workbook, run `python scripts/inventory-review/import_inventory.py /path/to/workbook.xlsx /path/to/output` (requires openpyxl). Review the generated data and rename `inventory.private.json` to `src/inventory.mock.json` only after approval for publication. Source workbook is not included. The importer flags price-like product names, missing rules or descriptions, invalid rates or volumes and CPM above 1,000. The CPM threshold is a cautious review trigger, not an asserted industry benchmark.
