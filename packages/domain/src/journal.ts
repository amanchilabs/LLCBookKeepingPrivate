export interface JournalLine {
  account: string;
  debitCents: bigint;
  creditCents: bigint;
}

export function assertBalancedEntry(lines: readonly JournalLine[]): void {
  if (lines.length < 2) throw new Error('A posted entry requires at least two lines.');
  let debits = 0n;
  let credits = 0n;
  for (const line of lines) {
    if (!line.account.trim()) throw new Error('Every journal line requires an account.');
    if (line.debitCents < 0n || line.creditCents < 0n) {
      throw new Error('Journal amounts cannot be negative.');
    }
    if (line.debitCents > 0n && line.creditCents > 0n) {
      throw new Error('A journal line cannot contain both a debit and a credit.');
    }
    debits += line.debitCents;
    credits += line.creditCents;
  }
  if (debits === 0n || debits !== credits) throw new Error('Journal entry is not balanced.');
}
