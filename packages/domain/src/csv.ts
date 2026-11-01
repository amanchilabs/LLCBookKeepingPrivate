/** Escape a CSV cell and prevent spreadsheet formula execution for text values. */
export function escapeCsvCell(value: string): string {
  const firstNonWhitespace = value.trimStart();
  const isPlainNegativeNumber = /^-\d+(?:\.\d+)?$/.test(firstNonWhitespace);
  const mayStartFormula = /^[=+@]/.test(firstNonWhitespace)
    || (firstNonWhitespace.startsWith('-') && !isPlainNegativeNumber);
  const safeValue = mayStartFormula ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}
