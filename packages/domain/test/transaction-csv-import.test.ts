import { describe, expect, it } from 'vitest';
import { parseCsvTable, previewCashImport, suggestCsvColumnMapping } from '../src/transaction-csv-import';

const categories = [
  { id: 'income-services', name: 'Sales and Services', kind: 'income' as const },
  { id: 'expense-rent', name: 'Rent', kind: 'expense' as const },
];

describe('CSV transaction import preview', () => {
  it('suggests mapped columns by header name and leaves unknown headers for review', () => {
    expect(suggestCsvColumnMapping(['Posted Date', 'Details', 'Net Amount', 'Category'])).toEqual({
      dateColumn: 0, descriptionColumn: 1, amountColumn: 2, categoryColumn: 3,
    });
    expect(suggestCsvColumnMapping(['When', 'Merchant', 'Debit', 'Memo'])).toEqual({
      dateColumn: 0, descriptionColumn: 1, amountColumn: 2, categoryColumn: 3,
    });
  });

  it('parses quoted commas, escaped quotes, CRLF, and embedded newlines', () => {
    expect(parseCsvTable('Date,Description,Amount,Category\r\n2026-01-02,"Cafe, ""North""\nMain",-12.50,Rent\r\n'))
      .toEqual([
        ['Date', 'Description', 'Amount', 'Category'],
        ['2026-01-02', 'Cafe, "North"\nMain', '-12.50', 'Rent'],
      ]);
  });

  it('rejects malformed quoted fields instead of silently shifting columns', () => {
    expect(() => parseCsvTable('Date,Description,Amount,Category\n2026-01-02,"Cafe,-12.50,Rent'))
      .toThrow('CSV contains an unterminated quoted field.');
  });

  it('maps signed amounts and category names to balanced income or expense rows', () => {
    const table = parseCsvTable([
      'Posted,Details,Net,Type',
      '2026-01-02,Client payment,400.00,Sales and Services',
      '01/03/2026,Monthly rent,-75.00,Rent',
    ].join('\n'));
    const rows = previewCashImport(table, {
      dateColumn: 0, descriptionColumn: 1, amountColumn: 2, categoryColumn: 3,
    }, 'bank-1', categories, [], '2026-01-01', null);

    expect(rows).toMatchObject([
      { rowNumber: 2, date: '2026-01-02', description: 'Client payment', amountCents: 40_000n,
        kind: 'income', categoryAccountId: 'income-services', possibleDuplicate: false, errors: [] },
      { rowNumber: 3, date: '2026-01-03', description: 'Monthly rent', amountCents: -7_500n,
        kind: 'expense', categoryAccountId: 'expense-rent', possibleDuplicate: false, errors: [] },
    ]);
  });

  it('accepts the dollar sign before or after a negative sign in CSV amounts', () => {
    const table = parseCsvTable([
      'Date,Description,Amount,Category',
      '2026-01-02,First rent,-$75.00,Rent',
      '2026-01-03,Second rent,$-75.00,Rent',
    ].join('\n'));
    const rows = previewCashImport(table, {
      dateColumn: 0, descriptionColumn: 1, amountColumn: 2, categoryColumn: 3,
    }, 'bank-1', categories, [], '2026-01-01', null);

    expect(rows.map((row) => row.amountCents)).toEqual([-7_500n, -7_500n]);
    expect(rows.map((row) => row.errors)).toEqual([[], []]);
  });

  it('flags existing and within-file possible duplicates without importing them implicitly', () => {
    const table = parseCsvTable([
      'Date,Description,Amount,Category',
      '2026-01-02,Monthly rent,-75.00,Rent',
      '2026-01-02,Monthly rent,-75.00,Rent',
    ].join('\n'));
    const rows = previewCashImport(table, {
      dateColumn: 0, descriptionColumn: 1, amountColumn: 2, categoryColumn: 3,
    }, 'bank-1', categories, [{
      date: '2026-01-02', accountId: 'bank-1', amountCents: -7_500n,
      categoryAccountId: 'expense-rent', description: 'Monthly rent',
    }], '2026-01-01', null);

    expect(rows.map((row) => row.possibleDuplicate)).toEqual([true, true]);
    expect(rows.every((row) => row.errors.length === 0)).toBe(true);
  });

  it('reports invalid date, amount, category kind, and closed-period rows before posting', () => {
    const table = parseCsvTable([
      'Date,Description,Amount,Category',
      '2026-01-02,Wrong direction,-75.00,Sales and Services',
      '2025-12-31,Before books,10.00,Sales and Services',
      'not-a-date,Missing date,10.00,Sales and Services',
      '2026-01-04,Invalid amount,abc,Rent',
      '2026-01-04,Closed period,10.00,Sales and Services',
      '2026-01-06,Unknown category,10.00,Unknown',
    ].join('\n'));
    const rows = previewCashImport(table, {
      dateColumn: 0, descriptionColumn: 1, amountColumn: 2, categoryColumn: 3,
    }, 'bank-1', categories, [], '2026-01-01', '2026-01-04');

    expect(rows[0].errors).toContain('Category must be an expense account for a negative amount.');
    expect(rows[1].errors).toContain('Transaction date cannot precede the bookkeeping start date.');
    expect(rows[2].errors).toContain('Enter a valid transaction date (YYYY-MM-DD or M/D/YYYY).');
    expect(rows[3].errors).toContain('Enter a valid non-zero USD amount.');
    expect(rows[4].errors).toContain('Transaction date is in a closed bookkeeping period.');
    expect(rows[5].errors).toContain('Map every category to an existing account of the matching type.');
  });
});
