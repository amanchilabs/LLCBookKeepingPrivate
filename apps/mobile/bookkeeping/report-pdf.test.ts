import { describe, expect, it } from 'vitest';
import { buildReportPdfHtml, REPORT_PDF_PAGE_SIZE } from './report-pdf';

describe('report PDF HTML', () => {
  it('uses landscape US Letter dimensions for report pages', () => {
    expect(REPORT_PDF_PAGE_SIZE).toEqual({ width: 792, height: 612, orientation: 'landscape' });
  });

  it('renders report values as escaped, local-only printable table content', () => {
    const html = buildReportPdfHtml({
      title: 'Cash movement',
      businessName: 'Northstar <Design> & Co.',
      period: '2026-03-01 through 2026-03-31',
      csv: [
        '"Account","Description","Ending balance"',
        '"Checking","Rent <script>alert(1)</script> & supplies","1560.00"',
      ].join('\r\n'),
    });

    expect(html).toContain('<table aria-label="Cash movement">');
    expect(html).toContain('<th scope="col">Account</th><th scope="col">Description</th><th scope="col">Ending balance</th>');
    expect(html).toContain('Northstar &lt;Design&gt; &amp; Co.');
    expect(html).toContain('Rent &lt;script&gt;alert(1)&lt;/script&gt; &amp; supplies');
    expect(html).toContain('2026-03-01 through 2026-03-31');
    expect(html).toContain('1560.00');
    expect(html).toContain('Bookkeeping report, not a tax return');
    expect(html).not.toContain('<script>');
    expect(html).not.toMatch(/(?:src|href)=["']https?:/i);
  });

  it('rejects empty or malformed report tables instead of creating misleading PDFs', () => {
    const metadata = { title: 'Trial Balance', businessName: 'Northstar LLC', period: 'As of 2026-03-31' };
    expect(() => buildReportPdfHtml({ ...metadata, csv: '' })).toThrow('Report data is empty.');
    expect(() => buildReportPdfHtml({ ...metadata, csv: '"Account","Debit"\r\n"Cash"' }))
      .toThrow('Report rows do not have a consistent number of columns.');
    expect(() => buildReportPdfHtml({ ...metadata, csv: '"Account' }))
      .toThrow('CSV contains an unterminated quoted field.');
  });

  it('directs reports above the PDF rendering limit to their full CSV export', () => {
    const csv = 'x'.repeat(5_000_001);
    expect(() => buildReportPdfHtml({ title: 'General Ledger', businessName: 'Northstar LLC', period: 'Through 2026-03-31', csv }))
      .toThrow('This report is too large for PDF export. Export the CSV instead.');
  });
});
