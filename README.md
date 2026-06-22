# eSLOG Utility Splitter

Browser-only React/TypeScript app for splitting Slovenian eSLOG utility invoices into separate water and waste XML files.

## Features

- Drag-and-drop XML upload
- Parses and classifies eSLOG invoice line items
- Generates separate `water` and `waste` XML exports
- Highlights source/import file when hovering exports and vice versa
- Downloads all outputs as a ZIP archive
- Runs fully in the browser without backend services

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Project Structure

- `src/` — React UI, hooks, parser/classifier/transformer logic
- `tests/` — unit tests for parsing, transform, validation, and ZIP export
- `fixtures/` — sample XML invoices for testing

## Notes

Output XML preserves the original invoice structure and removes digital signatures so the derived file remains compatible with downstream eSLOG tooling.
