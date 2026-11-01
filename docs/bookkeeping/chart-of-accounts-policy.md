# Chart of accounts policy

The mobile Accounts screen supports adding user-defined income and expense
accounts. Bank and cash accounts continue to use their separate account setup
flow. Asset, liability, and equity accounts remain controlled by the bookkeeping
engine so users cannot introduce an unexplained balance or change an account's
normal posting behavior.

Custom income account codes use the first available value from `4001` through
`4999`; custom expense account codes use `6001` through `6999`. Existing and
inactive codes are reserved and never reused. Codes are unique within an LLC.
Account names are also unique within an LLC without regard to letter case.

Adding an account does not modify prior journal entries or report totals. The
account becomes available for future transaction classification; income,
expense, and balance reports continue to derive from persisted journal lines.

Custom accounts cannot currently be renamed, archived, or deleted from the UI.
