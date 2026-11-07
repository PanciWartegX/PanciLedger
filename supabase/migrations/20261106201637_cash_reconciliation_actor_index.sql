create index if not exists cash_reconciliations_reconciled_by_idx
  on public.cash_reconciliations(reconciled_by);
