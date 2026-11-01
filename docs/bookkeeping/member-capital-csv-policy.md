# Member capital movement CSV policy

The Member Capital Movement CSV is a date-ranged export of persisted book
activity. It is a workpaper, not a tax-basis or outside-basis calculation.

The `Book capital movement` column is positive for cash and property
contributions and negative for distributions. The `Cash movement` column is
positive for cash contributions, negative for distributions, and zero for
property contributions. The final row totals both signed columns for the
selected period. Property descriptions and existing CPA-review flags are
preserved, with the source journal-entry identifier included for tracing.

The export does not assign values to contributed property, make special
allocations, infer tax consequences, or modify journal records. Property
contributions marked for review remain visibly flagged in the CSV.
