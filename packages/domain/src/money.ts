import Decimal from 'decimal.js';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

const USD_TEXT = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/;

export function parseUsd(text: string): bigint {
  const normalized = text.trim();
  if (!USD_TEXT.test(normalized)) {
    throw new Error('Enter a non-negative USD amount with at most two decimal places.');
  }
  return BigInt(new Decimal(normalized.replaceAll(',', '')).mul(100).toFixed(0));
}

export function formatUsd(cents: bigint): string {
  return new Decimal(cents.toString()).div(100).toFixed(2);
}

export function sumUsd(amounts: readonly bigint[]): bigint {
  return amounts.reduce((sum, amount) => sum + amount, 0n);
}
