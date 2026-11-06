"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const field = (data: FormData, name: string) => String(data.get(name) ?? "").trim();
const fail = (workspace: string, code: string): never =>
  redirect(`/?workspace=${encodeURIComponent(workspace)}&error=${encodeURIComponent(code)}`);

export async function createWorkspaceAction(data: FormData) {
  const name = field(data, "name");
  if (!name || name.length > 80) redirect("/?error=invalid_workspace_name");
  const db = await createClient();
  const { data: id, error } = await db.rpc("create_workspace", { workspace_name: name });
  if (error || !id) redirect("/?error=workspace_create_failed");
  revalidatePath("/");
  redirect(`/?workspace=${id}`);
}

export async function createAccountAction(data: FormData) {
  const workspace = field(data, "workspace_id");
  const name = field(data, "name");
  const currency = field(data, "currency") || "IDR";
  const opening = field(data, "opening_balance") || "0";
  if (!workspace || !name || !/^[A-Z]{3}$/.test(currency) || !/^-?\d+(\.\d{1,2})?$/.test(opening)) fail(workspace, "invalid_account");
  const db = await createClient();
  const { error } = await db.rpc("create_financial_account", {
    target_workspace: workspace, account_name: name, account_currency: currency, initial_balance: opening,
  });
  if (error) fail(workspace, "account_create_failed");
  revalidatePath("/");
  redirect(`/?workspace=${workspace}`);
}

export async function createAndPostTransactionAction(data: FormData) {
  const workspace = field(data, "workspace_id");
  const account = field(data, "account_id");
  const kind = field(data, "kind");
  const amount = field(data, "amount");
  const description = field(data, "description");
  if (!workspace || !account || !["INCOME", "EXPENSE"].includes(kind) || !/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || !description || description.length > 240) fail(workspace, "invalid_transaction");

  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: acct, error: accountError } = await db.from("financial_accounts")
    .select("currency").eq("id", account).eq("workspace_id", workspace).single();
  if (accountError || !acct) fail(workspace, "account_not_found");

  const { data: draft, error: insertError } = await db.from("financial_transactions").insert({
    workspace_id: workspace, account_id: account, kind, status: "DRAFT", amount,
    currency: acct.currency, description, direction: kind === "EXPENSE" ? "OUT" : "IN",
    idempotency_key: randomUUID(), created_by: auth.user.id,
  }).select("id").single();
  if (insertError || !draft) fail(workspace, "transaction_create_failed");

  const { error: postError } = await db.rpc("post_transaction", { target_transaction: draft.id });
  if (postError) fail(workspace, "transaction_post_failed");
  revalidatePath("/");
  redirect(`/?workspace=${workspace}`);
}

export async function createTransferAction(data: FormData) {
  const workspace = field(data, "workspace_id");
  const source = field(data, "source_account");
  const destination = field(data, "destination_account");
  const amount = field(data, "amount");
  const description = field(data, "description");
  if (!workspace || !source || !destination || source === destination || !/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || !description || description.length > 240) fail(workspace, "invalid_transfer");
  const db = await createClient();
  const { error } = await db.rpc("create_transfer", {
    target_workspace: workspace, source_account: source, destination_account: destination,
    transfer_amount: amount, transfer_description: description, request_key: randomUUID(),
  });
  if (error) fail(workspace, "transfer_failed");
  revalidatePath("/");
  redirect(`/?workspace=${workspace}`);
}

export async function reverseTransactionAction(data: FormData) {
  const workspace = field(data, "workspace_id");
  const transaction = field(data, "transaction_id");
  if (!workspace || !transaction) fail(workspace, "invalid_reversal");
  const db = await createClient();
  const { error } = await db.rpc("reverse_transaction", { target_transaction: transaction, request_key: randomUUID() });
  if (error) fail(workspace, "reversal_failed");
  revalidatePath("/");
  redirect(`/?workspace=${workspace}`);
}

export async function signOutAction() {
  const db = await createClient();
  await db.auth.signOut();
  redirect("/login");
}
