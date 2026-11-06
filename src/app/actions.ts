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
  if (!workspace || !name || name.length > 80 || !/^[A-Z]{3}$/.test(currency) || !/^-?\d+(\.\d{1,2})?$/.test(opening)) fail(workspace, "invalid_account");
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
  const { error } = await db.rpc("create_and_post_transaction", {
    target_workspace: workspace,
    target_account: account,
    transaction_type: kind,
    transaction_amount: amount,
    transaction_description: description,
    request_key: randomUUID(),
  });
  if (error) fail(workspace, "transaction_post_failed");
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

export async function createCashReconciliationAction(data: FormData) {
  const workspace = field(data, "workspace_id");
  const account = field(data, "account_id");
  const counted = field(data, "counted_balance");
  const notes = field(data, "notes");
  if (!workspace || !account || !/^\d+(\.\d{1,2})?$/.test(counted) || Number(counted) < 0 || Number(counted) > 999999999999999999 || notes.length > 500) {
    fail(workspace, "invalid_reconciliation");
  }

  const db = await createClient();
  const { error } = await db.rpc("create_cash_reconciliation", {
    target_workspace: workspace,
    target_account: account,
    counted_amount: counted,
    reconciliation_notes: notes,
    request_key: randomUUID(),
  });
  if (error) fail(workspace, "reconciliation_failed");
  revalidatePath("/");
  redirect(`/?workspace=${workspace}`);
}

export async function createBudgetAction(data: FormData) {
  const workspace = field(data, "workspace_id");
  const name = field(data, "name");
  const amount = field(data, "amount");
  const currency = field(data, "currency") || "IDR";
  const account = field(data, "account_id") || null;
  const start = field(data, "period_start");
  const end = field(data, "period_end");
  if (!workspace || !name || name.length > 80 || !/^[A-Z]{3}$/.test(currency)
      || !/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0
      || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)
      || start > end) fail(workspace, "invalid_budget");
  const db = await createClient();
  const { error } = await db.rpc("create_workspace_budget", {
    target_workspace: workspace, budget_name: name, budget_amount: amount,
    budget_currency: currency, target_account: account, period_start: start,
    period_end: end, request_key: randomUUID(),
  });
  if (error) fail(workspace, "budget_create_failed");
  revalidatePath("/");
  redirect(`/?workspace=${workspace}`);
}






export async function createWorkspaceInvitationAction(data: FormData) {
 const workspace=field(data,"workspace_id"),email=field(data,"email").toLowerCase(),role=field(data,"role");
 if(!workspace||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!["OWNER","ADMIN","TREASURER","AUDITOR","MEMBER","VIEWER"].includes(role)) fail(workspace,"invalid_invitation");
 const db=await createClient();
 const {data:token,error}=await db.rpc("create_workspace_invitation",{target_workspace:workspace,target_email:email,target_role:role});
 if(error||!token) fail(workspace,"invitation_create_failed");
 revalidatePath("/");
 redirect("/?workspace="+workspace+"&invite="+token);
}

export async function acceptWorkspaceInvitationAction(data: FormData) {
 const token=field(data,"invite_token");
 if(!/^[0-9a-f-]{36}$/i.test(token)) redirect("/?error=invalid_invitation");
 const db=await createClient();
 const {data:workspace,error}=await db.rpc("accept_workspace_invitation",{invite_token:token});
 if(error||!workspace) redirect("/?error=invitation_accept_failed");
 revalidatePath("/");
 redirect("/?workspace="+workspace);
}

export async function removeWorkspaceMemberAction(data: FormData) {
 const workspace=field(data,"workspace_id"),member=field(data,"member_id");
 if(!workspace||!member) fail(workspace,"invalid_member");
 const db=await createClient();
 const {error}=await db.rpc("remove_workspace_member",{target_workspace:workspace,target_user:member});
 if(error) fail(workspace,"member_remove_failed");
 revalidatePath("/");
 redirect("/?workspace="+workspace);
}

export async function changeWorkspaceMemberRoleAction(data: FormData) {
 const workspace=field(data,"workspace_id"),member=field(data,"member_id"),role=field(data,"role");
 if(!workspace||!member||!["OWNER","ADMIN","TREASURER","AUDITOR","MEMBER","VIEWER"].includes(role)) fail(workspace,"invalid_member");
 const db=await createClient();
 const {error}=await db.rpc("add_workspace_member",{target_workspace:workspace,target_user:member,assigned_role:role});
 if(error) fail(workspace,"member_role_failed");
 revalidatePath("/");
 redirect("/?workspace="+workspace);
}

export async function markNotificationReadAction(data: FormData) {
 const workspace=field(data,"workspace_id"),notification=field(data,"notification_id");
 if(!workspace||!notification) fail(workspace,"invalid_notification");
 const db=await createClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user) redirect("/login");
 const {error}=await db.from("notifications").update({read_at:new Date().toISOString()}).eq("id",notification).eq("workspace_id",workspace).eq("recipient_id",user.id);
 if(error) fail(workspace,"notification_update_failed");
 revalidatePath("/");
 redirect("/?workspace="+workspace);
}

export async function createRecurringTransactionAction(data: FormData) {
 const workspace=field(data,"workspace_id"),name=field(data,"name"),kind=field(data,"kind"),account=field(data,"account_id"),amount=field(data,"amount"),description=field(data,"description"),cadence=field(data,"cadence"),interval=field(data,"interval_days"),firstRun=field(data,"first_run_at");
 const customDays=cadence==="CUSTOM"?Number(interval):null;
 if(!workspace||!name||name.length>80||!["INCOME","EXPENSE"].includes(kind)||!account||!/^\d+(\.\d{1,2})?$/.test(amount)||Number(amount)<=0||Number(amount)>999999999999999999||!description||description.length>240||!["DAILY","WEEKLY","MONTHLY","YEARLY","CUSTOM"].includes(cadence)||!/^\d{4}-\d{2}-\d{2}$/.test(firstRun)||(cadence==="CUSTOM"&&(customDays===null||!Number.isInteger(customDays)||customDays<1||customDays>365))) fail(workspace,"invalid_recurring");
 const db=await createClient();
 const {error}=await db.rpc("create_recurring_transaction",{target_workspace:workspace,template_name:name,transaction_type:kind,target_account:account,template_amount:amount,template_description:description,template_cadence:cadence,custom_interval_days:customDays,first_run_date:firstRun});
 if(error) fail(workspace,"recurring_create_failed");
 revalidatePath("/");
 redirect("/?workspace="+workspace);
}

export async function executeDueRecurringAction(data: FormData) {
 const workspace=field(data,"workspace_id");
 if(!workspace) fail(workspace,"invalid_recurring");
 const db=await createClient();
 const {error}=await db.rpc("execute_due_recurring",{target_workspace:workspace,max_items:20});
 if(error) fail(workspace,"recurring_execute_failed");
 revalidatePath("/");
 redirect("/?workspace="+workspace);
}

export async function createSavingsGoalAction(data: FormData) {
  const workspace = field(data, "workspace_id");
  const name = field(data, "name");
  const target = field(data, "target_amount");
  const account = field(data, "account_id");
  const targetDate = field(data, "target_date") || null;
  if (!workspace || !name || name.length > 80 || !/^\d+(\.\d{1,2})?$/.test(target) || Number(target) <= 0 || Number(target) > 999999999999999999 || !account || (targetDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate))) fail(workspace, "invalid_savings_goal");
  const db = await createClient();
  const { data: accountRow, error: accountError } = await db.from("financial_accounts").select("currency").eq("id", account).eq("workspace_id", workspace).single();
  const accountCurrency = accountRow?.currency;
  if (accountError || !accountCurrency) fail(workspace, "invalid_savings_goal");
  const { error } = await db.rpc("create_savings_goal", {
    target_workspace: workspace, goal_name: name, goal_target: target,
    goal_currency: accountCurrency!, goal_account: account, goal_target_date: targetDate,
  });
  if (error) fail(workspace, "savings_goal_create_failed");
  revalidatePath("/");
  redirect("/?workspace=" + workspace);
}

export async function moveSavingsFundsAction(data: FormData) {
  const workspace = field(data, "workspace_id");
  const goal = field(data, "goal_id");
  const movement = field(data, "movement_type");
  const amount = field(data, "amount");
  const account = field(data, "other_account");
  if (!workspace || !goal || !["DEPOSIT", "WITHDRAWAL"].includes(movement) || !/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 999999999999999999 || !account) fail(workspace, "invalid_savings_movement");
  const db = await createClient();
  const { error } = await db.rpc("move_savings_funds", {
    target_goal: goal, movement_kind: movement, movement_amount: amount,
    other_account: account, request_key: randomUUID(),
  });
  if (error) fail(workspace, "savings_movement_failed");
  revalidatePath("/");
  redirect("/?workspace=" + workspace);
}

export async function createPooledFundAction(data: FormData) {
  const workspace = field(data, "workspace_id");
  const name = field(data, "name");
  const target = field(data, "target_amount");
  const account = field(data, "account_id");
  const targetDate = field(data, "target_date") || null;
  if (!workspace || !name || name.length > 80 || !/^\d+(\.\d{1,2})?$/.test(target) || Number(target) <= 0
      || Number(target) > 999999999999999999 || !account
      || (targetDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate))) fail(workspace, "invalid_pooled_fund");
  const db = await createClient();
  const { data: accountRow, error: accountError } = await db.from("financial_accounts").select("currency").eq("id", account).eq("workspace_id", workspace).single();
  const accountCurrency = accountRow?.currency;
  if (accountError || !accountCurrency) fail(workspace, "invalid_pooled_fund");
  const { error } = await db.rpc("create_pooled_fund", {
    target_workspace: workspace, fund_name: name, fund_target: target,
    fund_currency: accountCurrency!, target_account: account, fund_target_date: targetDate,
    request_key: randomUUID(),
  });
  if (error) fail(workspace, "pooled_fund_create_failed");
  revalidatePath("/");
  redirect("/?workspace=" + workspace);
}

export async function createPooledFundCommitmentAction(data: FormData) {
  const workspace = field(data, "workspace_id");
  const fund = field(data, "fund_id");
  const member = field(data, "member_id");
  const amount = field(data, "amount");
  if (!workspace || !fund || !member || !/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 999999999999999999) fail(workspace, "invalid_pooled_commitment");
  const db = await createClient();
  const { error } = await db.rpc("set_pooled_fund_commitment", {
    target_fund: fund, target_member: member, commitment_amount: amount,
  });
  if (error) fail(workspace, "pooled_commitment_failed");
  revalidatePath("/");
  redirect("/?workspace=" + workspace);
}

export async function createPooledFundContributionAction(data: FormData) {
  const workspace = field(data, "workspace_id");
  const fund = field(data, "fund_id");
  const member = field(data, "member_id");
  const amount = field(data, "amount");
  const notes = field(data, "notes");
  if (!workspace || !fund || !member || !/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 999999999999999999 || notes.length > 240) fail(workspace, "invalid_pooled_contribution");
  const db = await createClient();
  const { error } = await db.rpc("record_pooled_fund_contribution", {
    target_fund: fund, target_member: member, contribution_amount: amount, contribution_notes: notes,
    request_key: randomUUID(),
  });
  if (error) fail(workspace, "pooled_contribution_failed");
  revalidatePath("/");
  redirect("/?workspace=" + workspace);
}

export async function createPooledFundExpenseAction(data: FormData) {
  const workspace = field(data, "workspace_id");
  const fund = field(data, "fund_id");
  const amount = field(data, "amount");
  const description = field(data, "description");
  if (!workspace || !fund || !/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 999999999999999999 || !description || description.length > 240) fail(workspace, "invalid_pooled_expense");
  const db = await createClient();
  const { error } = await db.rpc("record_pooled_fund_expense", {
    target_fund: fund, expense_amount: amount, expense_description: description,
    request_key: randomUUID(),
  });
  if (error) fail(workspace, "pooled_expense_failed");
  revalidatePath("/");
  redirect("/?workspace=" + workspace);
}

export async function signOutAction() {
  const db = await createClient();
  await db.auth.signOut();
  redirect("/login");
}
