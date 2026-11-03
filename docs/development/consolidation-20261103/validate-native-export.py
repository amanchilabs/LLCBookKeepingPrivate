"""Validate only the synthetic native export captured during consolidation."""
from pathlib import Path
from decimal import Decimal
import csv
import subprocess

root = Path(__file__).parent / 'evidence'
with (root / 'android-synthetic-trial-balance.csv').open(newline='') as stream:
    rows = list(csv.DictReader(stream))
lines, totals = rows[:-1], rows[-1]
assert totals['Account'] == 'TOTALS'
assert sum(Decimal(row['Debit']) for row in lines) == Decimal(totals['Debit']) == Decimal('1350.00')
assert sum(Decimal(row['Credit']) for row in lines) == Decimal(totals['Credit']) == Decimal('1350.00')
accounts = {row['Account']: row for row in lines}
assert accounts['Operating checking']['Debit'] == '1275.00'
assert accounts['Sales and Services']['Credit'] == '250.00'
assert accounts['Office Supplies']['Debit'] == '75.00'
assert accounts['Opening Balance Equity']['Credit'] == '1000.00'
assert sum(Decimal(row['Credit']) for row in lines if row['Account'].startswith('Member capital')) == Decimal('100.00')
text = subprocess.check_output(['pdftotext', str(root / 'android-synthetic-trial-balance.pdf'), '-'], text=True)
for token in ['Trial Balance', 'Synthetic Consolidation LLC', '1275.00', '1350.00']:
    assert token in text, token
print('PASS: native CSV reconciles exactly; PDF identity, cash and totals match.')
