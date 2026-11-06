-- Keep transaction posting internal to the atomic transaction RPC.
-- The application writes through create_and_post_transaction only.
REVOKE ALL ON FUNCTION public.post_transaction(uuid) FROM PUBLIC, anon, authenticated;

-- Direct client inserts are not part of the supported write path.
REVOKE INSERT ON TABLE public.financial_transactions FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Treasury roles create transaction drafts" ON public.financial_transactions;
