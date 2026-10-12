# Shepard Banks Investments Brokering & Raise Income (static web)

Static, no-build site generated from `Elevate_Investor_CRM.xlsx` (Shepard Banks Investments · raise & brokering).

- `tools/extract.py` recalculates the workbook with LibreOffice and writes `data.js`.
  - `python3 tools/extract.py path/to/Elevate_Investor_CRM.xlsx`
  - Phone/email columns are stripped by default; add `--include-contacts` to keep them (not recommended for a public site).
- `index.html` + `style.css` + `app.js` render Dashboard, Investors, Deals, Commissions, Pipeline, Activity Log, Year by Year, Reconciliation, Notes.
- Deploy: push to a repo and enable GitHub Pages from the `main` branch, root folder.
