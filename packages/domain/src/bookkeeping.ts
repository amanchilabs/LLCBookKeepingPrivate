import { assertBalancedEntry, type JournalLine } from './journal';

export interface MemberInterestInput {
  id: string;
  name: string;
  ownershipBasisPoints: number;
}

export interface BusinessSetupInput {
  id: string;
  name: string;
  formationState: string;
  formationDate: string;
  bookkeepingStartDate: string;
  members: readonly MemberInterestInput[];
  ownershipConfirmed: boolean;
}

export const SUGGESTED_MEMBER_INTERESTS_BASIS_POINTS = [4_000, 2_000, 2_000, 2_000] as const;

export function parseOwnershipPercent(text: string): number {
  const normalized = text.trim();
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) throw new Error('Enter a valid percentage with at most two decimal places.');
  const basisPoints = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (basisPoints > 10_000) throw new Error('Each ownership interest must be between 0% and 100%.');
  return basisPoints;
}

const FORMATION_JURISDICTIONS = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'AS', 'GU', 'MP', 'PR', 'VI',
]);

function assertValidCalendarDate(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Enter a valid date for ${field}.`);
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Enter a valid date for ${field}.`);
  }
}

export function assertOwnershipTotals(members: readonly MemberInterestInput[]): void {
  if (members.length === 0) throw new Error('Add at least one LLC member.');
  const ids = new Set<string>();
  let totalBasisPoints = 0;
  for (const member of members) {
    if (!member.id.trim() || ids.has(member.id)) throw new Error('Member identifiers must be unique.');
    ids.add(member.id);
    if (!member.name.trim()) throw new Error('Every member requires a name.');
    if (!Number.isInteger(member.ownershipBasisPoints)
      || member.ownershipBasisPoints < 0
      || member.ownershipBasisPoints > 10_000) {
      throw new Error('Each ownership interest must be between 0% and 100%.');
    }
    totalBasisPoints += member.ownershipBasisPoints;
  }
  if (totalBasisPoints !== 10_000) throw new Error('Member ownership interests must total 100%.');
}

export function assertValidBusinessSetup(input: BusinessSetupInput): void {
  if (!input.id.trim()) throw new Error('Business identifier is required.');
  if (!input.name.trim()) throw new Error('Enter the LLC business name.');
  if (!FORMATION_JURISDICTIONS.has(input.formationState.trim().toUpperCase())) {
    throw new Error('Enter a supported two-letter formation state or territory.');
  }
  assertValidCalendarDate(input.formationDate, 'formation date');
  assertValidCalendarDate(input.bookkeepingStartDate, 'bookkeeping start date');
  assertOwnershipTotals(input.members);
  if (!input.ownershipConfirmed) throw new Error('Confirm the ownership interests before creating the LLC.');
}

function assertPositiveAmount(amountCents: bigint): void {
  if (amountCents <= 0n) throw new Error('Transaction amounts must be positive.');
}

export function openingBalanceLines(
  cashAccountId: string,
  openingEquityAccountId: string,
  signedAmountCents: bigint,
): JournalLine[] {
  if (signedAmountCents === 0n) throw new Error('Opening balance entries require a non-zero amount.');
  const amount = signedAmountCents < 0n ? -signedAmountCents : signedAmountCents;
  const lines: JournalLine[] = signedAmountCents > 0n
    ? [
      { account: cashAccountId, debitCents: amount, creditCents: 0n },
      { account: openingEquityAccountId, debitCents: 0n, creditCents: amount },
    ]
    : [
      { account: openingEquityAccountId, debitCents: amount, creditCents: 0n },
      { account: cashAccountId, debitCents: 0n, creditCents: amount },
    ];
  assertBalancedEntry(lines);
  return lines;
}

export function cashIncomeLines(cashAccountId: string, incomeAccountId: string, amountCents: bigint): JournalLine[] {
  assertPositiveAmount(amountCents);
  const lines: JournalLine[] = [
    { account: cashAccountId, debitCents: amountCents, creditCents: 0n },
    { account: incomeAccountId, debitCents: 0n, creditCents: amountCents },
  ];
  assertBalancedEntry(lines);
  return lines;
}

export function cashExpenseLines(cashAccountId: string, expenseAccountId: string, amountCents: bigint): JournalLine[] {
  assertPositiveAmount(amountCents);
  const lines: JournalLine[] = [
    { account: expenseAccountId, debitCents: amountCents, creditCents: 0n },
    { account: cashAccountId, debitCents: 0n, creditCents: amountCents },
  ];
  assertBalancedEntry(lines);
  return lines;
}

export function cashCapitalContributionLines(
  cashAccountId: string,
  memberCapitalAccountId: string,
  amountCents: bigint,
): JournalLine[] {
  assertPositiveAmount(amountCents);
  const lines: JournalLine[] = [
    { account: cashAccountId, debitCents: amountCents, creditCents: 0n },
    { account: memberCapitalAccountId, debitCents: 0n, creditCents: amountCents },
  ];
  assertBalancedEntry(lines);
  return lines;
}

export function propertyCapitalContributionLines(
  propertyAssetAccountId: string,
  memberCapitalAccountId: string,
  amountCents: bigint,
): JournalLine[] {
  assertPositiveAmount(amountCents);
  const lines: JournalLine[] = [
    { account: propertyAssetAccountId, debitCents: amountCents, creditCents: 0n },
    { account: memberCapitalAccountId, debitCents: 0n, creditCents: amountCents },
  ];
  assertBalancedEntry(lines);
  return lines;
}

export function memberDistributionLines(
  memberCapitalAccountId: string,
  cashAccountId: string,
  amountCents: bigint,
): JournalLine[] {
  assertPositiveAmount(amountCents);
  const lines: JournalLine[] = [
    { account: memberCapitalAccountId, debitCents: amountCents, creditCents: 0n },
    { account: cashAccountId, debitCents: 0n, creditCents: amountCents },
  ];
  assertBalancedEntry(lines);
  return lines;
}

export function reverseLines(lines: readonly JournalLine[]): JournalLine[] {
  assertBalancedEntry(lines);
  const reversed = lines.map((line) => ({
    account: line.account,
    debitCents: line.creditCents,
    creditCents: line.debitCents,
  }));
  assertBalancedEntry(reversed);
  return reversed;
}
