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

export function accountTransferLines(
  sourceAccountId: string,
  destinationAccountId: string,
  amountCents: bigint,
): JournalLine[] {
  if (!sourceAccountId.trim() || !destinationAccountId.trim()) {
    throw new Error('Choose a source and destination account for the transfer.');
  }
  if (sourceAccountId === destinationAccountId) throw new Error('Transfer accounts must be different.');
  if (amountCents <= 0n) throw new Error('Transfer amounts must be positive.');
  const lines: JournalLine[] = [
    { account: destinationAccountId, debitCents: amountCents, creditCents: 0n },
    { account: sourceAccountId, debitCents: 0n, creditCents: amountCents },
  ];
  assertBalancedEntry(lines);
  return lines;
}

export function loanAdvanceLines(cashAccountId: string, liabilityAccountId: string, amountCents: bigint): JournalLine[] {
  if (amountCents <= 0n) throw new Error('Loan advances must be positive.');
  const lines: JournalLine[] = [
    { account: cashAccountId, debitCents: amountCents, creditCents: 0n },
    { account: liabilityAccountId, debitCents: 0n, creditCents: amountCents },
  ];
  assertBalancedEntry(lines);
  return lines;
}

export function loanRepaymentLines(
  cashAccountId: string,
  liabilityAccountId: string,
  interestExpenseAccountId: string,
  principalCents: bigint,
  interestCents: bigint,
): JournalLine[] {
  if (principalCents < 0n || interestCents < 0n) throw new Error('Loan repayment amounts cannot be negative.');
  if (principalCents === 0n && interestCents === 0n) {
    throw new Error('A loan repayment must include a positive principal or interest amount.');
  }
  const lines: JournalLine[] = [];
  if (principalCents > 0n) {
    lines.push({ account: liabilityAccountId, debitCents: principalCents, creditCents: 0n });
  }
  if (interestCents > 0n) {
    lines.push({ account: interestExpenseAccountId, debitCents: interestCents, creditCents: 0n });
  }
  lines.push({
    account: cashAccountId,
    debitCents: 0n,
    creditCents: principalCents + interestCents,
  });
  assertBalancedEntry(lines);
  return lines;
}
