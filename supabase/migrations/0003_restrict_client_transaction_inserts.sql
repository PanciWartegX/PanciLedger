-- Clients may create drafts only. Posting must move through a validated,
-- atomic database function so users cannot insert arbitrary posted ledger rows.
drop policy if exists "Treasury roles create transactions" on public.financial_transactions;

create policy "Treasury roles create transaction drafts" on public.financial_transactions
for insert to authenticated
with check (
  status = 'DRAFT'
  and posted_at is null
  and created_by = (select auth.uid())
  and public.has_workspace_role(
    workspace_id,
    array['OWNER','ADMIN','TREASURER']::public.workspace_role[]
  )
);

-- Explicitly document that authenticated clients cannot update/delete ledger rows.
-- Later draft editing and posting will be exposed through narrowly scoped RPCs.
