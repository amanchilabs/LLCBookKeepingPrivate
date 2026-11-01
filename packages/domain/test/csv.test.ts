import { describe, expect, it } from 'vitest';
import { escapeCsvCell } from '../src/csv';

describe('CSV cell escaping', () => {
  it('quotes cell contents and neutralizes spreadsheet formula prefixes', () => {
    expect(escapeCsvCell('=SUM(1,1)')).toBe('"\'=SUM(1,1)"');
    expect(escapeCsvCell('  +cmd|...')).toBe('"\'  +cmd|..."');
    expect(escapeCsvCell('\t@value')).toBe('"\'\t@value"');
    expect(escapeCsvCell('-1+2')).toBe('"\'-1+2"');
  });

  it('keeps signed numeric amounts usable and escapes embedded quotes', () => {
    expect(escapeCsvCell('-12.50')).toBe('"-12.50"');
    expect(escapeCsvCell('Owner said "rent"')).toBe('"Owner said ""rent"""');
  });
});
