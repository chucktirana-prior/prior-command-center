# Uploader Fixture Tests

This folder contains synthetic editorial PDFs used to regression-test the Prior uploader parser against messy, human-created document patterns.

Current coverage includes:
- marketing metadata before article body
- `Keep reading` as the hard handoff into body copy
- mixed metadata on the same line such as `Keywords: ... Slug: ...`
- multi-line metadata fields
- alternate label aliases like `Email intro text` and `Social caption`
- inline body copy that starts on the same line as `Keep reading:`

Run the suite with:

```bash
npm run test:uploader-fixtures
```

To also write generated PDF fixtures and parsed JSON snapshots to a temp directory:

```bash
node tests/uploader/run-parser-fixtures.mjs --write-fixtures
```
