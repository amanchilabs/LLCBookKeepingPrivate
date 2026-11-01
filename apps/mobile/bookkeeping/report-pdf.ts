import { parseCsvTable } from '../../../packages/domain/src/transaction-csv-import';

export const REPORT_PDF_PAGE_SIZE = { width: 792, height: 612, orientation: 'landscape' } as const;

export interface ReportPdfInput {
  title: string;
  businessName: string;
  period: string;
  csv: string;
}

const escapeHtml = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export function buildReportPdfHtml(input: ReportPdfInput): string {
  if (input.csv.length > 5_000_000) {
    throw new Error('This report is too large for PDF export. Export the CSV instead.');
  }
  const rows = parseCsvTable(input.csv);
  const [headers, ...dataRows] = rows;
  if (!headers?.length || dataRows.length === 0) throw new Error('Report data is empty.');
  if (rows.some((row) => row.length !== headers.length)) {
    throw new Error('Report rows do not have a consistent number of columns.');
  }

  const headerHtml = headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join('');
  const bodyHtml = dataRows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
  <title>${escapeHtml(input.title)} · ${escapeHtml(input.businessName)}</title>
  <style>
    @page { size: letter landscape; margin: 0.5in; }
    body { color: #18202c; font-family: Arial, Helvetica, sans-serif; font-size: 9pt; }
    h1 { font-size: 18pt; margin: 0 0 5pt; }
    .business { font-size: 12pt; font-weight: 600; margin: 0 0 4pt; }
    .period { color: #465466; margin: 0 0 14pt; }
    .notice { color: #465466; font-size: 8pt; margin: 0 0 12pt; }
    table { border-collapse: collapse; table-layout: auto; width: 100%; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th, td { border: 1px solid #c8d0da; padding: 5px 6px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    th { background: #edf1f5; font-weight: 700; }
    td { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>${escapeHtml(input.title)}</h1>
  <p class="business">${escapeHtml(input.businessName)}</p>
  <p class="period">${escapeHtml(input.period)}</p>
  <p class="notice">Bookkeeping report, not a tax return or tax advice. Figures reflect records entered for this LLC and may require CPA review.</p>
  <table aria-label="${escapeHtml(input.title)}">
    <thead><tr>${headerHtml}</tr></thead>
    <tbody>${bodyHtml}</tbody>
  </table>
</body>
</html>`;
}
