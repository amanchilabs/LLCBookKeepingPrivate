# Split transaction policy

One income or expense transaction can allocate its full amount to two or more
active accounts of the same income or expense kind. Each allocation is a
positive fixed-precision amount, and allocations must sum exactly to the
transaction total. A split transaction posts one cash movement and one journal
line per category allocation, so it remains a single searchable and
reconcilable transaction.

The encrypted database stores allocation rows beside the transaction and
journal. Schema version 9 adds this table without rewriting existing entries;
legacy transactions are read as a one-category allocation. Corrections reverse
the original journal entry and retain its allocations for audit history. The
replacement may use a different set of allocations.

Transaction CSV expands split allocations into separate category rows using the
same cash account and description. The row amounts retain the original
transaction's direction, so exported cash movements and category totals
reconcile with the journal. Transfers remain two signed cash-account rows and
do not use category splits.
