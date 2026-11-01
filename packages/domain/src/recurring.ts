export type RecurringCadence = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

function parseRecurringDate(value: string): { year: number; month: number; day: number } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Enter a valid recurring date.');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('Enter a valid recurring date.');
  }
  return { year, month, day };
}

/** Returns the next occurrence while preserving the original day-of-month anchor. */
export function nextRecurringDate(dateValue: string, cadence: RecurringCadence, anchorDay?: number): string {
  const { year, month, day } = parseRecurringDate(dateValue);
  if (!['weekly', 'monthly', 'quarterly', 'yearly'].includes(cadence)) {
    throw new Error('Choose a supported recurrence interval.');
  }
  const dayAnchor = anchorDay ?? day;
  if (!Number.isInteger(dayAnchor) || dayAnchor < 1 || dayAnchor > 31) {
    throw new Error('The recurring day anchor must be between 1 and 31.');
  }
  if (cadence === 'weekly') {
    const next = new Date(Date.UTC(year, month - 1, day + 7));
    return next.toISOString().slice(0, 10);
  }
  const monthStep = cadence === 'monthly' ? 1 : cadence === 'quarterly' ? 3 : 12;
  const monthIndex = year * 12 + month - 1 + monthStep;
  const nextYear = Math.floor(monthIndex / 12);
  const nextMonth = monthIndex % 12 + 1;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  const nextDay = Math.min(dayAnchor, lastDay);
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
}
