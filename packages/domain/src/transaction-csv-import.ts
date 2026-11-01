import { parseUsd } from './money';

export interface CsvColumnMapping {
  dateColumn: number;
  descriptionColumn: number;
  amountColumn: number;
  categoryColumn: number;
}

export interface CsvImportCategory {
  id: string;
  name: string;
  kind: 'income' | 'expense';
}

export interface CsvImportExistingTransaction {
  date: string;
  accountId: string;
  amountCents: bigint;
  categoryAccountId: string;
  description: string;
}

export interface CsvImportPreviewRow {
  rowNumber: number;
  date: string;
  description: string;
  amountCents: bigint;
  kind: 'income' | 'expense' | null;
  categoryAccountId: string | null;
  possibleDuplicate: boolean;
  errors: string[];
}

export function parseCsvTable(source: string): string[][] {
  if (source.length > 5_000_000) throw new Error('CSV files must be smaller than 5 MB.');
  const text = source.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let afterQuote = false;

  const finishField = () => {
    row.push(field);
    field = '';
    afterQuote = false;
  };
  const finishRow = () => {
    finishField();
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (afterQuote) {
      if (character === ',') {
        finishField();
      } else if (character === '\r' || character === '\n') {
        finishRow();
        if (character === '\r' && text[index + 1] === '\n') index += 1;
      } else if (character === ' ' || character === '\t') {
        // Ignore whitespace between a closing quote and its delimiter.
      } else {
        throw new Error('CSV has unexpected content after a closing quote.');
      }
      continue;
    }

    if (character === ',') {
      finishField();
    } else if (character === '\r' || character === '\n') {
      finishRow();
      if (character === '\r' && text[index + 1] === '\n') index += 1;
    } else if (character === '"') {
      if (field.length > 0) throw new Error('CSV has a quote inside an unquoted field.');
      quoted = true;
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  if (field.length > 0 || row.length > 0 || afterQuote) finishRow();
  return rows;
}

export function suggestCsvColumnMapping(headers: readonly string[]): CsvColumnMapping {
  const find = (candidates: readonly string[], fallback: number): number => {
    const index = headers.findIndex((header) => candidates.includes(header.trim().toLowerCase()));
    return index >= 0 ? index : Math.min(fallback, Math.max(0, headers.length - 1));
  };
  return {
    dateColumn: find(['date', 'posted date', 'transaction date'], 0),
    descriptionColumn: find(['description', 'details', 'payee', 'merchant', 'memo'], 1),
    amountColumn: find(['amount', 'net amount', 'signed amount'], 2),
    categoryColumn: find(['category', 'type'], 3),
  };
}

export function previewCashImport(
  table: readonly (readonly string[])[],
  mapping: CsvColumnMapping,
  accountId: string,
  categories: readonly CsvImportCategory[],
  existingTransactions: readonly CsvImportExistingTransaction[],
  bookkeepingStartDate: string,
  closedThroughDate: string | null,
): CsvImportPreviewRow[] {
  if (table.length < 2) throw new Error('CSV requires a header row and at least one data row.');
  if (!accountId) throw new Error('Choose the bank or cash account that received this import.');
  const columns = [
    mapping.dateColumn, mapping.descriptionColumn, mapping.amountColumn, mapping.categoryColumn,
  ];
  if (columns.some((column) => !Number.isInteger(column) || column < 0 || column >= table[0].length)
    || new Set(columns).size !== columns.length) {
    throw new Error('Map date, description, amount, and category to separate CSV columns.');
  }

  const seen = new Set(existingTransactions.map((transaction) => cashImportDuplicateKey(
    transaction.date, transaction.accountId, transaction.amountCents,
    transaction.categoryAccountId, transaction.description,
  )));
  const result: CsvImportPreviewRow[] = [];

  for (const [index, cells] of table.slice(1).entries()) {
    const errors: string[] = [];
    const dateText = cellAt(cells, mapping.dateColumn);
    const description = cellAt(cells, mapping.descriptionColumn).trim();
    const amountText = cellAt(cells, mapping.amountColumn);
    const categoryText = cellAt(cells, mapping.categoryColumn).trim();
    const date = parseImportDate(dateText);
    let amountCents = 0n;
    let kind: CsvImportPreviewRow['kind'] = null;
    let categoryAccountId: string | null = null;

    if (!date) {
      errors.push('Enter a valid transaction date (YYYY-MM-DD or M/D/YYYY).');
    } else {
      if (date < bookkeepingStartDate) errors.push('Transaction date cannot precede the bookkeeping start date.');
      if (closedThroughDate && date <= closedThroughDate) errors.push('Transaction date is in a closed bookkeeping period.');
    }
    if (!description) errors.push('Enter a transaction description.');
    try {
      amountCents = parseSignedUsd(amountText);
      if (amountCents === 0n) throw new Error();
      kind = amountCents > 0n ? 'income' : 'expense';
    } catch {
      errors.push('Enter a valid non-zero USD amount.');
    }

    if (kind) {
      const matchedCategory = categories.find((category) =>
        category.kind === kind && category.name.trim().toLowerCase() === categoryText.toLowerCase());
      if (matchedCategory) {
        categoryAccountId = matchedCategory.id;
      } else {
        const otherKindExists = categories.some((category) =>
          category.name.trim().toLowerCase() === categoryText.toLowerCase());
        if (otherKindExists) {
          const expectedKind = kind === 'income' ? 'income' : 'expense';
          const sign = amountCents > 0n ? 'positive' : 'negative';
          errors.push('Category must be an ' + expectedKind + ' account for a ' + sign + ' amount.');
        } else {
          errors.push('Map every category to an existing account of the matching type.');
        }
      }
    } else {
      errors.push('A category can only be checked after the amount is valid.');
    }

    const possibleDuplicate = Boolean(date && kind && categoryAccountId)
      && seen.has(cashImportDuplicateKey(date!, accountId, amountCents, categoryAccountId!, description));
    if (date && kind && categoryAccountId) {
      seen.add(cashImportDuplicateKey(date, accountId, amountCents, categoryAccountId, description));
    }
    result.push({
      rowNumber: index + 2, date: date ?? '', description, amountCents, kind, categoryAccountId,
      possibleDuplicate, errors,
    });
  }
  return result;
}

function parseSignedUsd(value: string): bigint {
  let unsigned = value.trim();
  if (unsigned.startsWith('$')) unsigned = unsigned.slice(1).trim();
  const sign = unsigned.startsWith('-') ? -1n : 1n;
  if (unsigned.startsWith('-') || unsigned.startsWith('+')) unsigned = unsigned.slice(1).trim();
  if (unsigned.startsWith('$')) unsigned = unsigned.slice(1).trim();
  if (!unsigned) throw new Error('Invalid amount.');
  return sign * parseUsd(unsigned);
}

function parseImportDate(value: string): string | null {
  const trimmed = value.trim();
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  let year: string;
  let month: string;
  let day: string;
  if (isoDate) {
    [, year, month, day] = isoDate;
  } else {
    const usDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
    if (!usDate) return null;
    [, month, day, year] = usDate;
    month = month.padStart(2, '0');
    day = day.padStart(2, '0');
  }
  const normalized = year + '-' + month + '-' + day;
  const parsed = new Date(normalized + 'T00:00:00.000Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized ? normalized : null;
}

function cellAt(cells: readonly string[], column: number): string {
  return cells[column] ?? '';
}

export function cashImportDuplicateKey(
  date: string,
  accountId: string,
  amountCents: bigint,
  categoryAccountId: string,
  description: string,
): string {
  return JSON.stringify([date, accountId, amountCents.toString(), categoryAccountId, description.trim().toLowerCase()]);
}
