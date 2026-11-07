import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CircleDollarSign, LogOut, Plus, ShieldCheck, Wallet } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FinanceCharts } from "@/components/finance-charts";
import { createAccountAction, createAndPostTransactionAction, createBudgetAction, createCashReconciliationAction, createWorkspaceInvitationAction, acceptWorkspaceInvitationAction, removeWorkspaceMemberAction, changeWorkspaceMemberRoleAction, markNotificationReadAction, createRecurringTransactionAction, executeDueRecurringAction, createSavingsGoalAction, moveSavingsFundsAction, createPooledFundAction, createPooledFundCommitmentAction, createPooledFundContributionAction, createPooledFundExpenseAction, createTransferAction, createWorkspaceAction, reverseTransactionAction } from "@/app/actions";

type Props = { searchParams: Promise<{ workspace?: string; error?: string; invite?: string; accept_invite?: string; view?: string }> };
const money = (n: number, currency = "IDR") => new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
const date = (s: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(s));
const roleLabel = (role: string) => (({ OWNER: "Pemilik", ADMIN: "Administrator", TREASURER: "Bendahara", AUDITOR: "Auditor", VIEWER: "Hanya lihat", MEMBER: "Anggota" }) as Record<string, string>)[role] ?? role;
const kindLabel = (kind: string) => (({ INCOME: "Pemasukan", EXPENSE: "Pengeluaran", TRANSFER: "Transfer", REVERSAL: "Pembalikan" }) as Record<string, string>)[kind] ?? kind;
const actionLabel = (action: string) => (({
  WORKSPACE_CREATED: "Ruang kerja dibuat", ACCOUNT_CREATED: "Akun dibuat",
  TRANSACTION_POSTED: "Transaksi dibukukan", TRANSFER_CREATED: "Transfer dibuat",
  TRANSACTION_REVERSED: "Transaksi dibalikkan", MEMBER_ADDED: "Anggota ditambahkan",
  MEMBER_REMOVED: "Anggota dihapus", ROLE_CHANGED: "Peran anggota diubah"
} as Record<string, string>)[action] ?? action.replaceAll("_", " ").toLowerCase());
const errorLabel = (code: string) => (({
  invalid_workspace_name: "Nama ruang kerja tidak valid",
  workspace_create_failed: "Gagal membuat ruang kerja",
  invalid_account: "Data akun tidak valid",
  account_create_failed: "Gagal membuat akun",
  invalid_transaction: "Data transaksi tidak valid",
  transaction_post_failed: "Gagal menyimpan transaksi",
  invalid_transfer: "Data transfer tidak valid",
  transfer_failed: "Gagal melakukan transfer",
  invalid_reversal: "Data pembalikan tidak valid",
  reversal_failed: "Gagal membalikkan transaksi",
  invalid_reconciliation: "Data rekonsiliasi kas tidak valid",
  reconciliation_failed: "Gagal menyimpan rekonsiliasi kas",
  invalid_budget: "Data anggaran tidak valid",
  budget_create_failed: "Gagal membuat anggaran",
  invalid_pooled_fund: "Data dana bersama tidak valid",
  pooled_fund_create_failed: "Gagal membuat dana bersama",
  invalid_pooled_commitment: "Data komitmen iuran tidak valid",
  pooled_commitment_failed: "Gagal menyimpan komitmen anggota",
  invalid_pooled_contribution: "Data iuran tidak valid",
  pooled_contribution_failed: "Gagal mencatat iuran",
  invalid_pooled_expense: "Data pengeluaran dana tidak valid",
  pooled_expense_failed: "Gagal membukukan pengeluaran dana",
  invalid_savings_goal: "Data target tabungan tidak valid",
  savings_goal_create_failed: "Gagal membuat target tabungan",
  invalid_savings_movement: "Data setoran atau penarikan tidak valid",
  savings_movement_failed: "Gagal memproses perpindahan dana tabungan",
  invalid_recurring: "Data transaksi berulang tidak valid",
  recurring_create_failed: "Gagal membuat transaksi berulang",
  recurring_execute_failed: "Gagal menjalankan transaksi yang jatuh tempo",
  invalid_notification: "Notifikasi tidak valid",
  notification_update_failed: "Gagal memperbarui notifikasi",
  invalid_invitation: "Data undangan tidak valid",
  invitation_create_failed: "Gagal membuat undangan",
  invitation_accept_failed: "Undangan tidak dapat diterima",
  invalid_member: "Data anggota tidak valid",
  member_remove_failed: "Gagal menghapus anggota",
  member_role_failed: "Gagal mengubah peran anggota"
} as Record<string, string>)[code] ?? "Terjadi kesalahan. Silakan coba lagi.");
const currencyTotals = (entries: { currency: string; amount: number }[]) => {
  const totals = new Map<string, number>();
  for (const entry of entries) totals.set(entry.currency.trim(), (totals.get(entry.currency.trim()) ?? 0) + entry.amount);
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => money(amount, currency)).join(" · ") || money(0);
};

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect(params.accept_invite ? "/login?next="+encodeURIComponent("/?accept_invite="+params.accept_invite) : "/login");

  const { data: memberships } = await db.from("workspace_members").select("workspace_id,user_id,role").eq("user_id", user.id);
  const rows = memberships ?? [];
  const { data: invitationRows } = await db.from("workspace_invitations").select("id,workspace_id,invited_email,assigned_role,invite_token,expires_at,accepted_at").order("created_at",{ascending:false}).limit(20);
  const invitations = invitationRows ?? [];
  const ids = rows.map((m) => m.workspace_id);
  const { data: spaces } = ids.length ? await db.from("workspaces").select("id,name").in("id", ids) : { data: [] as {id:string;name:string}[] };
  const workspaces = spaces ?? [];
  const active = workspaces.find((w) => w.id === params.workspace) ?? workspaces[0];
  if (!active) return <main className="grid min-h-screen place-items-center px-5"><section className="panel w-full max-w-lg p-8"><Brand/>{params.accept_invite && <div className="mt-8 rounded-xl border border-emerald-400/20 bg-emerald-400/[.05] p-4"><h1 className="text-lg font-semibold">Kamu menerima undangan</h1><p className="muted mt-1 text-sm">Pastikan kamu masuk menggunakan alamat email yang menerima undangan.</p><form action={acceptWorkspaceInvitationAction} className="mt-3"><input type="hidden" name="invite_token" value={params.accept_invite}/><button className="primary w-full">Terima undangan</button></form></div>}<h1 className="mt-8 text-2xl font-semibold">Buat ruang kerja pertamamu</h1><p className="muted mt-2 text-sm">Pisahkan setiap kelompok akun dan anggota dalam ruang kerja tersendiri.</p><form action={createWorkspaceAction} className="mt-6 space-y-3"><input name="name" required maxLength={80} placeholder="Keuangan pribadi" className="field"/><button className="primary w-full"><Plus size={16}/> Buat ruang kerja</button></form><form action="/auth/logout" method="post" className="mt-5"><button className="muted text-sm">Keluar</button></form></section></main>;

  const role = rows.find((m) => m.workspace_id === active.id)?.role ?? "VIEWER";
  const canWrite = ["OWNER","ADMIN","TREASURER"].includes(role);
  const canManageWorkspace = ["OWNER","ADMIN"].includes(role);
  const canReadFinance = ["OWNER","ADMIN","TREASURER","AUDITOR"].includes(role);
  const menuItems = [
    { key: "dashboard", label: "Dashboard", roles: ["OWNER","ADMIN","TREASURER","AUDITOR","MEMBER","VIEWER"] },
    { key: "accounts", label: "Akun keuangan", roles: ["OWNER","ADMIN","TREASURER","AUDITOR","MEMBER","VIEWER"] },
    { key: "transactions", label: "Transaksi", roles: ["OWNER","ADMIN","TREASURER","AUDITOR","MEMBER","VIEWER"] },
    { key: "finance", label: "Keuangan & anggaran", roles: ["OWNER","ADMIN","TREASURER","AUDITOR"] },
    { key: "planning", label: "Perencanaan", roles: ["OWNER","ADMIN","TREASURER","AUDITOR","MEMBER","VIEWER"] },
    { key: "notifications", label: "Notifikasi", roles: ["OWNER","ADMIN","TREASURER","AUDITOR","MEMBER","VIEWER"] },
    { key: "workspace", label: "Anggota & akses", roles: ["OWNER","ADMIN"] },
    { key: "reports", label: "Laporan & audit", roles: ["OWNER","ADMIN","AUDITOR"] },
    { key: "profile", label: "Profil akun", roles: ["OWNER","ADMIN","TREASURER","AUDITOR","MEMBER","VIEWER"] },
  ].filter(item => item.roles.includes(role));
  const requestedView = params.view ?? "dashboard";
  const view = menuItems.some(item => item.key === requestedView) ? requestedView : "dashboard";
  const viewTitle = menuItems.find(item => item.key === view)?.label ?? "Dashboard";
  const [{ data: accounts }, { data: transactions }, { data: audit }, { data: reconciliationRows }, { data: budgetRows }, { data: budgetUsageRows }, { data: pooledFundRows }, { data: pooledBalanceRows }, { data: pooledProgressRows }, { data: pooledContributionRows }, { data: pooledExpenseRows }, { data: savingsGoalRows }, { data: savingsProgressRows }, { data: savingsMovementRows }, { data: recurringRows }, { data: recurringLogRows }, { data: notificationRows }, { data: trendRows }] = await Promise.all([
    db.from("workspace_account_balances").select("id,name,currency,current_balance,is_active").eq("workspace_id", active.id).order("created_at"),
    db.from("financial_transactions").select("id,kind,amount,currency,description,occurred_at,direction").eq("workspace_id", active.id).eq("status", "POSTED").order("occurred_at", {ascending:false}).limit(12),
    db.from("workspace_audit_log").select("id,action,created_at").eq("workspace_id", active.id).order("created_at", {ascending:false}).limit(6),
    db.from("cash_reconciliations").select("id,account_id,expected_balance,counted_balance,difference,notes,created_at").eq("workspace_id", active.id).order("created_at", {ascending:false}).limit(8),
    db.from("workspace_budgets").select("id,name,amount,currency,period_start,period_end,account_id,is_active,created_at").eq("workspace_id", active.id).eq("is_active", true).order("period_start", {ascending:false}),
    db.from("workspace_budget_usage").select("budget_id,spent").eq("workspace_id", active.id),
    db.from("pooled_funds").select("id,name,target_amount,currency,account_id,target_date,is_active,created_at").eq("workspace_id", active.id).eq("is_active", true).order("created_at", {ascending:false}),
    db.from("pooled_fund_balances").select("fund_id,balance,total_contributions,total_expenses").eq("workspace_id", active.id),
    db.from("pooled_fund_member_progress").select("fund_id,member_id,committed_amount,paid_amount,status").eq("workspace_id", active.id),
    db.from("pooled_fund_contributions").select("id,fund_id,contributor_id,amount,notes,created_at,transaction_id").eq("workspace_id", active.id).order("created_at", {ascending:false}).limit(12),
    db.from("pooled_fund_expenses").select("id,fund_id,created_by,amount,description,created_at,transaction_id").eq("workspace_id", active.id).order("created_at", {ascending:false}).limit(8),
    db.from("savings_goals").select("id,name,target_amount,currency,account_id,target_date,is_active,created_at").eq("workspace_id", active.id).eq("is_active", true).order("created_at", {ascending:false}),
    db.from("savings_goal_progress").select("goal_id,total_deposits,total_withdrawals,balance").eq("workspace_id", active.id),
    db.from("savings_movements").select("id,goal_id,movement_type,amount,created_at,transfer_id").eq("workspace_id", active.id).order("created_at", {ascending:false}).limit(10),
    db.from("recurring_transactions").select("id,name,transaction_type,account_id,amount,description,cadence,interval_days,next_run_at,last_run_at,is_active").eq("workspace_id", active.id).eq("is_active", true).order("next_run_at"),
    db.from("recurring_execution_logs").select("id,recurring_transaction_id,scheduled_for,transaction_id,amount,executed_at").eq("workspace_id", active.id).order("executed_at", {ascending:false}).limit(10),
    db.from("notifications").select("id,notification_type,title,body,created_at,read_at").eq("workspace_id", active.id).eq("recipient_id", user.id).order("created_at", {ascending:false}).limit(8),
    db.from("financial_transactions").select("occurred_at,direction,amount,currency").eq("workspace_id", active.id).eq("status", "POSTED").gte("occurred_at", new Date(Date.now()-365*24*60*60*1000).toISOString()).order("occurred_at", {ascending:true}).limit(5000),
  ]);
  const accts = accounts ?? [];
  const txs = transactions ?? [];
  const totalByCurrency = accts.map(a => ({ currency: a.currency, amount: Number(a.current_balance) }));
  const inflows = txs.filter(t => t.direction === "IN").map(t => ({ currency: t.currency, amount: Number(t.amount) }));
  const outflows = txs.filter(t => t.direction === "OUT").map(t => ({ currency: t.currency, amount: Number(t.amount) }));
  const activeAccounts = accts.filter(a=>a.is_active);
  const reconciliations = reconciliationRows ?? [];
  const budgets = budgetRows ?? [];
  const budgetSpent = new Map((budgetUsageRows ?? []).map((item) => [item.budget_id, Number(item.spent)]));
  const pooledFunds = pooledFundRows ?? [];
  const pooledBalances = new Map((pooledBalanceRows ?? []).map((item) => [item.fund_id, item]));
  const pooledProgress = pooledProgressRows ?? [];
  const pooledContributions = pooledContributionRows ?? [];
  const pooledExpenses = pooledExpenseRows ?? [];
  const pooledTransactionIds = new Set([...pooledContributions.map((c) => c.transaction_id), ...pooledExpenses.map((e) => e.transaction_id)]);
  const savingsGoals = savingsGoalRows ?? [];
  const savingsProgress = new Map((savingsProgressRows ?? []).map((item) => [item.goal_id, item]));
  const savingsMovements = savingsMovementRows ?? [];
  const savingsGoalById = new Map(savingsGoals.map((g) => [g.id, g]));
  const recurringTemplates = recurringRows ?? [];
  const recurringLogs = recurringLogRows ?? [];
  const recurringById = new Map(recurringTemplates.map((r) => [r.id, r]));
  const notifications = notificationRows ?? [];
  const trendMap = new Map<string, {currency:string; months:Map<string,{income:number;expense:number}>}>();
  for (const row of trendRows ?? []) {
    const currency = row.currency.trim();
    const monthKey = row.occurred_at.slice(0,7);
    if (!trendMap.has(currency)) trendMap.set(currency,{currency,months:new Map()});
    const entry=trendMap.get(currency)!;
    if (!entry.months.has(monthKey)) entry.months.set(monthKey,{income:0,expense:0});
    const point=entry.months.get(monthKey)!;
    if(row.direction==="IN") point.income+=Number(row.amount); else point.expense+=Number(row.amount);
  }
  const trendSeries=[...trendMap.values()].map(item=>({currency:item.currency,points:[...item.months.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([month,v])=>({month:new Intl.DateTimeFormat("id-ID",{month:"short",year:"2-digit"}).format(new Date(month+"-01T00:00:00")),income:v.income,expense:v.expense}))}));
  const unreadNotifications = notifications.filter((n) => !n.read_at).length;
  const { data: memberRows } = await db.from("workspace_members").select("workspace_id,user_id,role").eq("workspace_id", active.id).order("created_at", { ascending: true });
  const workspaceMembers = memberRows ?? [];
  const { data: profileRows } = workspaceMembers.length
    ? await db.from("profiles").select("id,username,display_name").in("id", workspaceMembers.map(m => m.user_id))
    : { data: [] as {id:string;username:string;display_name:string}[] };
  const profileById = new Map((profileRows ?? []).map(profile => [profile.id, profile]));
  const ownProfile = profileById.get(user.id);
  const workspaceInvitations = invitations.filter((i) => i.workspace_id === active.id && !i.accepted_at && new Date(i.expires_at)>new Date());
  const fundById = new Map(pooledFunds.map((f) => [f.id, f]));
  const accountById = new Map(accts.map(a => [a.id, a]));

  return <main className="min-h-screen lg:flex">
    <aside className="hidden w-64 shrink-0 border-r border-white/[.07] px-5 py-7 lg:flex lg:flex-col"><Brand/><div className="mt-10 text-[10px] uppercase tracking-[.2em] text-slate-500">Ruang kerja</div><form action="/" method="get" className="mt-3 space-y-2"><select name="workspace" defaultValue={active.id} className="field">{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><button className="secondary w-full text-xs">Ganti ruang kerja</button></form><form action={createWorkspaceAction} className="mt-3 flex gap-2"><input name="name" required maxLength={80} placeholder="Ruang kerja baru" className="field min-w-0 text-xs"/><button className="secondary shrink-0 text-xs"><Plus size={14}/></button></form><div className="mt-4 rounded-xl border border-white/10 p-3"><div className="text-sm font-medium">{active.name}</div><div className="muted mt-1 text-xs">{roleLabel(role)}</div></div><nav className="mt-8 space-y-1 text-sm">
      {menuItems.map(item => <a key={item.key} href={"/"+item.key+"?workspace="+active.id} aria-current={view===item.key?"page":undefined} className={"flex items-center justify-between rounded-xl px-3 py-2.5 transition "+(view===item.key?"bg-emerald-400/10 text-emerald-300":"text-slate-400 hover:bg-white/[.04] hover:text-slate-200")}>
        <span>{item.label}</span>
        {item.key==="notifications" && unreadNotifications>0 ? <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-semibold text-slate-950">{unreadNotifications}</span> : null}
      </a>)}
    </nav><div className="mt-auto rounded-xl border border-emerald-400/15 bg-emerald-400/[.05] p-4"><div className="flex items-center gap-2 text-sm text-emerald-200"><ShieldCheck size={16}/> Dilindungi RLS</div><p className="muted mt-2 text-xs">Akses ruang kerja diperiksa langsung oleh PostgreSQL.</p></div><form action="/auth/logout" method="post" className="mt-5"><button className="muted flex items-center gap-2 text-sm"><LogOut size={15}/> Keluar</button></form></aside>
    <section className="min-w-0 flex-1 px-5 py-6 md:px-8 lg:px-10">
      <header className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-medium">{ownProfile?.display_name ?? user.email}</div><div className="muted mt-0.5 text-xs">{ownProfile?.username ? "@"+ownProfile.username+" · " : ""}{user.email}</div><h1 className="mt-2 text-xl font-semibold">{viewTitle}</h1></div><div className="flex items-center gap-2"><span className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400">{roleLabel(role)}</span><form action="/auth/logout" method="post"><button className="secondary flex items-center gap-2"><LogOut size={15}/> Keluar</button></form></div></header>
      <form action="/" method="get" className="mt-4 flex gap-2 lg:hidden"><select name="workspace" defaultValue={active.id} className="field flex-1">{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><button className="secondary shrink-0">Ganti</button></form><form action={createWorkspaceAction} className="mt-2 flex gap-2 lg:hidden"><input name="name" required maxLength={80} placeholder="Nama ruang kerja baru" className="field flex-1"/><button className="secondary shrink-0"><Plus size={15}/> Buat</button></form>
<nav className="mt-5 flex gap-2 overflow-x-auto pb-2 lg:hidden">{menuItems.map(item=><a key={item.key} href={"/"+item.key+"?workspace="+active.id} aria-current={view===item.key?"page":undefined} className={"shrink-0 rounded-xl border px-3 py-2 text-xs "+(view===item.key?"border-emerald-400/30 bg-emerald-400/10 text-emerald-300":"border-white/10 text-slate-400")}>{item.label}</a>)}</nav>
      {params.error && <p role="alert" className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/5 p-3 text-sm text-rose-200">Aksi gagal: {errorLabel(params.error)}. Periksa hak akses dan penerapan migrasi database.</p>}
{view === "dashboard" && <>
      <div className="mt-8"><div className="muted text-sm">{active.name}</div><h2 className="mt-1 text-2xl font-semibold">Ringkasan keuanganmu</h2><p className="muted mt-2 text-sm">Saldo terkini berdasarkan transaksi yang sudah dibukukan.</p></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3"><Metric label="Total saldo" value={currencyTotals(totalByCurrency)} note={`${accts.length} akun · dikelompokkan berdasarkan mata uang`} icon="wallet"/><Metric label="Uang masuk · 12 transaksi terbaru" value={currencyTotals(inflows)} note="Termasuk transfer dan pembatalan transaksi" icon="in"/><Metric label="Uang keluar · 12 transaksi terbaru" value={currencyTotals(outflows)} note="Termasuk transfer dan pembatalan transaksi" icon="out"/></div>
      <FinanceCharts series={trendSeries}/>
</>}

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {view === "accounts" && (<section className="panel p-5"><h3 className="font-semibold">Akun</h3><p className="muted mt-1 text-xs">Saldo terhitung otomatis</p>{accts.length ? <div className="mt-4 divide-y divide-white/[.06]">{accts.map(a=><div key={a.id} className="flex justify-between gap-3 py-3"><div><div className="text-sm font-medium">{a.name}</div><div className="muted text-xs">{a.currency} · {a.is_active?"Aktif":"Diarsipkan"}</div></div><div className="text-sm font-semibold">{money(Number(a.current_balance),a.currency.trim())}</div></div>)}</div>:<p className="muted mt-4 text-sm">Belum ada akun.</p>}
          {canWrite && <form action={createAccountAction} className="mt-5 grid gap-3 border-t border-white/[.07] pt-5 sm:grid-cols-2"><input type="hidden" name="workspace_id" value={active.id}/><input name="name" required maxLength={80} placeholder="Nama akun" className="field"/><input name="opening_balance" required inputMode="decimal" defaultValue="0" placeholder="Saldo awal" className="field"/><select name="currency" className="field"><option value="IDR">IDR</option><option value="USD">USD</option><option value="MYR">MYR</option></select><button className="secondary"><Plus size={15}/> Buat akun</button></form>}
        </section>)}

        {view === "transactions" && (<section className="panel p-5"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Transaksi terbaru</h3><a className="muted text-xs underline" href={"/api/reports/transactions?workspace="+active.id}>Ekspor CSV</a></div><p className="muted mt-1 text-xs">Aktivitas transaksi yang sudah dibukukan</p>{txs.length?<div className="mt-4 divide-y divide-white/[.06]">{txs.map(t=><div key={t.id} className="flex items-start justify-between gap-2 py-3"><div className="min-w-0"><div className="truncate text-sm font-medium">{t.description}</div><div className="muted mt-1 text-xs">{kindLabel(t.kind)} · {date(t.occurred_at)}</div></div><div className={`shrink-0 text-sm font-semibold ${t.direction==="IN"?"text-emerald-300":"text-slate-200"}`}>{t.direction==="IN"?"+":"−"} {money(Number(t.amount),t.currency.trim())}</div>{canWrite && !["REVERSAL","TRANSFER"].includes(t.kind) && !pooledTransactionIds.has(t.id) && <form action={reverseTransactionAction}><input type="hidden" name="workspace_id" value={active.id}/><input type="hidden" name="transaction_id" value={t.id}/><button className="muted text-[10px] underline">Balikkan</button></form>}</div>)}</div>:<p className="muted mt-4 text-sm">Belum ada transaksi yang dibukukan.</p>}</section>)}

      </div>
      {view === "transactions" && canWrite && <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <section id="new-transaction" className="panel p-5"><h3 className="font-semibold">Transaksi baru</h3><p className="muted mt-1 text-xs">Disiapkan lalu divalidasi sebelum dibukukan</p>{activeAccounts.length?<form action={createAndPostTransactionAction} className="mt-4 space-y-3"><input type="hidden" name="workspace_id" value={active.id}/><select name="account_id" className="field">{activeAccounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select><div className="grid grid-cols-2 gap-3"><select name="kind" className="field"><option value="INCOME">Pemasukan</option><option value="EXPENSE">Pengeluaran</option></select><input name="amount" required inputMode="decimal" placeholder="Jumlah" className="field"/></div><input name="description" required maxLength={240} placeholder="Keterangan" className="field"/><button className="primary w-full">Simpan dan bukukan</button></form>:<p className="muted mt-4 text-sm">Buat akun aktif terlebih dahulu.</p>}</section>
        <section className="panel p-5"><h3 className="font-semibold">Transfer dana</h3><p className="muted mt-1 text-xs">Transfer dua sisi diproses secara atomik.</p>{activeAccounts.length>=2?<form action={createTransferAction} className="mt-4 space-y-3"><input type="hidden" name="workspace_id" value={active.id}/><select name="source_account" className="field">{activeAccounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select><select name="destination_account" className="field">{activeAccounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select><input name="amount" required inputMode="decimal" placeholder="Jumlah" className="field"/><input name="description" required maxLength={240} placeholder="Keterangan" className="field"/><button className="secondary w-full"><ArrowLeftRight size={16}/> Transfer</button></form>:<p className="muted mt-4 text-sm">Buat dua akun aktif dengan mata uang yang sama.</p>}</section>
      </div>}
      {view === "finance" && canReadFinance && (<section className="panel mt-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-semibold">Rekonsiliasi kas</h3><p className="muted mt-1 text-xs">Bandingkan saldo buku dengan uang yang benar-benar dihitung. Catatan ini tidak mengubah saldo akun.</p></div>
          <span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400">{reconciliations.length} catatan terbaru</span>
        </div>
        {canWrite && activeAccounts.length > 0 && <form action={createCashReconciliationAction} className="mt-4 grid gap-3 border-b border-white/[.07] pb-5 sm:grid-cols-2">
          <input type="hidden" name="workspace_id" value={active.id}/>
          <select name="account_id" className="field">{activeAccounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select>
          <input name="counted_balance" type="number" min="0" step="0.01" required inputMode="decimal" placeholder="Saldo hasil hitung fisik" className="field"/>
          <input name="notes" maxLength={500} placeholder="Catatan (opsional)" className="field sm:col-span-2"/>
          <button className="secondary sm:col-span-2">Simpan hasil rekonsiliasi</button>
        </form>}
        {reconciliations.length ? <div className="mt-3 divide-y divide-white/[.06]">
          {reconciliations.map(r => {
            const account = accountById.get(r.account_id);
            const currency = account?.currency?.trim() ?? "IDR";
            const difference = Number(r.difference);
            return <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0"><div className="text-sm font-medium">{account?.name ?? "Akun tidak tersedia"}</div><div className="muted mt-1 text-xs">{date(r.created_at)}{r.notes ? ` · ${r.notes}` : ""}</div><div className="muted mt-1 text-xs">Buku: {money(Number(r.expected_balance),currency)} · Hitung: {money(Number(r.counted_balance),currency)}</div></div>
              <div className={`text-sm font-semibold ${difference === 0 ? "text-emerald-300" : "text-amber-300"}`}>{difference > 0 ? "+" : ""}{money(difference,currency)}</div>
            </div>;
          })}
        </div> : <p className="muted mt-4 text-sm">Belum ada rekonsiliasi kas.</p>}
      </section>)}







      {view === "workspace" && canManageWorkspace && (<section className="panel mt-6 p-5">
        <div><h3 className="font-semibold">Anggota & undangan</h3><p className="muted mt-1 text-xs">Kelola akses ruang kerja. Tautan undangan dapat dibagikan langsung kepada email tujuan.</p></div>
        {["OWNER","ADMIN"].includes(role) && <form action={createWorkspaceInvitationAction} className="mt-4 grid gap-2 sm:grid-cols-3"><input type="hidden" name="workspace_id" value={active.id}/><input type="email" name="email" required placeholder="Email anggota" className="field"/><select name="role" className="field"><option value="MEMBER">Anggota</option><option value="TREASURER">Bendahara</option><option value="AUDITOR">Auditor</option><option value="VIEWER">Hanya lihat</option>{role==="OWNER"&&<><option value="ADMIN">Administrator</option><option value="OWNER">Pemilik</option></>}</select><button className="secondary">Buat undangan</button></form>}
        {params.invite && <div className="mt-3 rounded-lg border border-emerald-400/20 p-3 text-xs"><div className="font-medium">Tautan undangan berhasil dibuat</div><a className="mt-1 block break-all underline" href={"/?accept_invite="+params.invite}>{typeof window==="undefined"?"Buka tautan undangan":window.location.origin+"/?accept_invite="+params.invite}</a></div>}
        <div className="mt-4 divide-y divide-white/[.06]">{workspaceMembers.map(m=><div key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><div className="text-sm font-medium">{profileById.get(m.user_id)?.display_name ?? profileById.get(m.user_id)?.username ?? "Pengguna"}</div><div className="muted text-xs">{roleLabel(m.role)}</div></div>{["OWNER","ADMIN"].includes(role)&&m.user_id!==user.id&&<div className="flex flex-wrap gap-2"><form action={changeWorkspaceMemberRoleAction} className="flex gap-1"><input type="hidden" name="workspace_id" value={active.id}/><input type="hidden" name="member_id" value={m.user_id}/><select name="role" defaultValue={m.role} className="field text-xs"><option value="MEMBER">Anggota</option><option value="TREASURER">Bendahara</option><option value="AUDITOR">Auditor</option><option value="VIEWER">Hanya lihat</option>{role==="OWNER"&&<><option value="ADMIN">Administrator</option><option value="OWNER">Pemilik</option></>}</select><button className="muted text-xs underline">Ubah</button></form><form action={removeWorkspaceMemberAction}><input type="hidden" name="workspace_id" value={active.id}/><input type="hidden" name="member_id" value={m.user_id}/><button className="text-xs text-rose-300 underline">Hapus</button></form></div>}</div>)}</div>
        {workspaceInvitations.length>0&&<div className="mt-4 border-t border-white/[.07] pt-4"><h4 className="text-sm font-semibold">Undangan aktif</h4>{workspaceInvitations.map(i=><div key={i.id} className="flex flex-wrap justify-between gap-2 py-2 text-xs"><span>{i.invited_email} · {roleLabel(i.assigned_role)}<span className="muted block">Berlaku sampai {date(i.expires_at)}</span></span><a className="underline" href={"/?accept_invite="+i.invite_token}>Tautan</a></div>)}</div>}
        {params.accept_invite && <form action={acceptWorkspaceInvitationAction} className="mt-4 rounded-xl border border-white/[.08] p-3"><input type="hidden" name="invite_token" value={params.accept_invite}/><p className="text-sm font-medium">Undangan ruang kerja</p><p className="muted mt-1 text-xs">Pastikan Anda masuk menggunakan alamat email yang menerima undangan.</p><button className="secondary mt-3 w-full">Terima undangan</button></form>}
      </section>)}


      {view === "notifications" && (<section className="panel mt-6 p-5">
        <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Notifikasi</h3><p className="muted mt-1 text-xs">Pembaruan transaksi dalam ruang kerja ini</p></div><span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs">{unreadNotifications} belum dibaca</span></div>
        {notifications.length?<div className="mt-3 divide-y divide-white/[.06]">{notifications.map(n=><div key={n.id} className="flex items-start justify-between gap-3 py-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className={"h-2 w-2 rounded-full "+(n.read_at?"bg-slate-600":"bg-emerald-400")}/><span className="text-sm font-medium">{n.title}</span></div><p className="muted mt-1 text-xs">{n.body}</p><p className="muted mt-1 text-[10px]">{date(n.created_at)}</p></div>{!n.read_at&&<form action={markNotificationReadAction}><input type="hidden" name="workspace_id" value={active.id}/><input type="hidden" name="notification_id" value={n.id}/><button className="muted shrink-0 text-xs underline">Tandai dibaca</button></form>}</div>)}</div>:<p className="muted mt-4 text-sm">Belum ada notifikasi.</p>}
      </section>)}


      {view === "planning" && (<section className="panel mt-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Transaksi berulang</h3><p className="muted mt-1 text-xs">Template transaksi dengan pencatatan ledger idempoten. Eksekusi saat ini manual oleh bendahara; scheduler otomatis memerlukan konfigurasi server terpisah.</p></div><span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400">{recurringTemplates.length} jadwal aktif</span></div>
        {canWrite && activeAccounts.length>0 && <form action={createRecurringTransactionAction} className="mt-4 grid gap-2 border-b border-white/[.07] pb-5 sm:grid-cols-2"><input type="hidden" name="workspace_id" value={active.id}/><input name="name" required maxLength={80} placeholder="Nama jadwal" className="field"/><select name="kind" className="field"><option value="EXPENSE">Pengeluaran</option><option value="INCOME">Pemasukan</option></select><select name="account_id" required className="field">{activeAccounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select><input name="amount" type="number" min="0.01" step="0.01" required placeholder="Nominal" className="field"/><input name="description" required maxLength={240} placeholder="Keterangan transaksi" className="field"/><select name="cadence" className="field"><option value="DAILY">Harian</option><option value="WEEKLY">Mingguan</option><option value="MONTHLY">Bulanan</option><option value="YEARLY">Tahunan</option><option value="CUSTOM">Interval khusus</option></select><input name="interval_days" type="number" min="1" max="365" placeholder="Interval hari (khusus)" className="field"/><label className="muted text-xs">Tanggal eksekusi pertama<input name="first_run_at" type="date" required className="field mt-1"/></label><button className="secondary sm:col-span-2"><Plus size={15}/> Buat jadwal berulang</button></form>}
        {canWrite && recurringTemplates.some(r=>r.next_run_at<=new Date().toISOString().slice(0,10)) && <form action={executeDueRecurringAction} className="mt-4"><input type="hidden" name="workspace_id" value={active.id}/><button className="secondary w-full">Jalankan transaksi jatuh tempo (maks. 20)</button></form>}
        {recurringTemplates.length>0?<div className="mt-4 divide-y divide-white/[.06]">{recurringTemplates.map(r=><div key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><div className="text-sm font-medium">{r.name}</div><div className="muted mt-1 text-xs">{r.transaction_type==="EXPENSE"?"Pengeluaran":"Pemasukan"} · {r.cadence==="CUSTOM"?"Setiap "+r.interval_days+" hari":({DAILY:"Harian",WEEKLY:"Mingguan",MONTHLY:"Bulanan",YEARLY:"Tahunan"} as Record<string,string>)[r.cadence]} · Berikutnya {r.next_run_at}</div></div><div className="text-right text-sm font-semibold">{money(Number(r.amount),accountById.get(r.account_id)?.currency?.trim()??"IDR")}</div></div>)}</div>:<p className="muted mt-4 text-sm">Belum ada jadwal transaksi berulang.</p>}
        {recurringLogs.length>0 && <div className="mt-5 border-t border-white/[.07] pt-4"><h4 className="text-sm font-semibold">Eksekusi terakhir</h4><div className="mt-2 divide-y divide-white/[.06]">{recurringLogs.map(log=><div key={log.id} className="flex justify-between gap-2 py-2 text-xs"><span>{recurringById.get(log.recurring_transaction_id)?.name??"Jadwal"}<span className="muted block">Periode {log.scheduled_for} · {date(log.executed_at)}</span></span><span>{money(Number(log.amount),accountById.get(recurringById.get(log.recurring_transaction_id)?.account_id)?.currency?.trim()??"IDR")}</span></div>)}</div></div>}
      </section>)}


      {view === "planning" && (<section className="panel mt-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Target tabungan</h3><p className="muted mt-1 text-xs">Setoran dan penarikan memindahkan saldo antar-akun melalui transaksi transfer ledger.</p></div><span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400">{savingsGoals.length} target aktif</span></div>
        {canWrite && activeAccounts.length>1 && <form action={createSavingsGoalAction} className="mt-4 grid gap-2 border-b border-white/[.07] pb-5 sm:grid-cols-2"><input type="hidden" name="workspace_id" value={active.id}/><input name="name" required maxLength={80} placeholder="Nama target tabungan" className="field"/><input name="target_amount" type="number" min="0.01" step="0.01" required placeholder="Target nominal" className="field"/><select name="account_id" required className="field">{activeAccounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select><label className="muted text-xs">Tanggal target (opsional)<input name="target_date" type="date" className="field mt-1"/></label><button className="secondary sm:col-span-2"><Plus size={15}/> Buat target tabungan</button></form>}
        {savingsGoals.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{savingsGoals.map(g=>{const p=savingsProgress.get(g.id);const balance=Number(p?.balance??0);const target=Number(g.target_amount);const pct=target>0?Math.max(0,Math.min(100,Math.round(balance/target*100))):0;return <div key={g.id} className="rounded-xl border border-white/[.08] p-4"><div className="flex justify-between gap-3"><div><div className="text-sm font-medium">{g.name}</div><div className="muted mt-1 text-xs">{accountById.get(g.account_id)?.name??"Akun tabungan"}{g.target_date?" · "+g.target_date:""}</div></div><span className="text-sm font-semibold text-emerald-300">{pct}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{width:pct+"%"}}/></div><div className="mt-2 flex justify-between gap-2 text-xs"><span className="muted">Terkumpul</span><span>{money(balance,g.currency.trim())} / {money(target,g.currency.trim())}</span></div><div className="muted mt-1 text-xs">Setoran {money(Number(p?.total_deposits??0),g.currency.trim())} · Penarikan {money(Number(p?.total_withdrawals??0),g.currency.trim())}</div></div>})}</div>:<p className="muted mt-4 text-sm">Belum ada target tabungan.</p>}
        {canWrite && savingsGoals.length>0 && <div className="mt-5 grid gap-4 border-t border-white/[.07] pt-5 md:grid-cols-2"><div><h4 className="text-sm font-semibold">Setor ke tabungan</h4><form action={moveSavingsFundsAction} className="mt-3 space-y-2"><input type="hidden" name="workspace_id" value={active.id}/><input type="hidden" name="movement_type" value="DEPOSIT"/><select name="goal_id" required className="field">{savingsGoals.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select><select name="other_account" required className="field">{activeAccounts.filter(a=>!savingsGoals.some(g=>g.account_id===a.id)).map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select><input name="amount" type="number" min="0.01" step="0.01" required placeholder="Nominal setoran" className="field"/><button className="secondary w-full">Transfer ke tabungan</button></form></div><div><h4 className="text-sm font-semibold">Tarik dari tabungan</h4><form action={moveSavingsFundsAction} className="mt-3 space-y-2"><input type="hidden" name="workspace_id" value={active.id}/><input type="hidden" name="movement_type" value="WITHDRAWAL"/><select name="goal_id" required className="field">{savingsGoals.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select><select name="other_account" required className="field">{activeAccounts.filter(a=>!savingsGoals.some(g=>g.account_id===a.id)).map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select><input name="amount" type="number" min="0.01" step="0.01" required placeholder="Nominal penarikan" className="field"/><button className="secondary w-full">Transfer dari tabungan</button></form></div></div>}
        {savingsMovements.length>0 && <div className="mt-5 border-t border-white/[.07] pt-4"><h4 className="text-sm font-semibold">Riwayat tabungan terbaru</h4><div className="mt-2 divide-y divide-white/[.06]">{savingsMovements.map(m=>{const g=savingsGoalById.get(m.goal_id);return <div key={m.id} className="flex justify-between gap-2 py-2 text-xs"><span>{g?.name??"Tabungan"} · {m.movement_type==="DEPOSIT"?"Setoran":"Penarikan"}<span className="muted block">{date(m.created_at)}</span></span><span className={m.movement_type==="DEPOSIT"?"text-emerald-300":"text-amber-300"}>{m.movement_type==="DEPOSIT"?"+":"−"}{money(Number(m.amount),g?.currency?.trim()??"IDR")}</span></div>})}</div></div>}
      </section>)}


      {view === "planning" && (<section className="panel mt-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Dana bersama</h3><p className="muted mt-1 text-xs">Iuran dan pengeluaran dibukukan sebagai transaksi ledger pada akun dana.</p></div><span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400">{pooledFunds.length} dana aktif</span></div>
        {canWrite && activeAccounts.length > 0 && <form action={createPooledFundAction} className="mt-4 grid gap-3 border-b border-white/[.07] pb-5 sm:grid-cols-2"><input type="hidden" name="workspace_id" value={active.id}/><input name="name" required maxLength={80} placeholder="Nama dana bersama" className="field"/><input name="target_amount" type="number" min="0.01" step="0.01" required placeholder="Target dana" className="field"/><select name="account_id" className="field" required>{activeAccounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select><label className="muted text-xs">Batas waktu (opsional)<input name="target_date" type="date" className="field mt-1"/></label><button className="secondary sm:col-span-2"><Plus size={15}/> Buat dana bersama</button></form>}
        {pooledFunds.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{pooledFunds.map(f=>{const b=pooledBalances.get(f.id);const total=Number(b?.total_contributions??0);const spent=Number(b?.total_expenses??0);const balance=Number(b?.balance??0);const target=Number(f.target_amount);const pct=target>0?Math.min(100,Math.round(total/target*100)):0;return <div key={f.id} className="rounded-xl border border-white/[.08] p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-medium">{f.name}</div><div className="muted mt-1 text-xs">Target {money(target,f.currency.trim())}{f.target_date ? " · "+f.target_date : ""}</div></div><div className="text-sm font-semibold text-emerald-300">{pct}%</div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{width:pct+"%"}}/></div><div className="muted mt-2 flex flex-wrap justify-between gap-2 text-xs"><span>Masuk: {money(total,f.currency.trim())}</span><span>Keluar: {money(spent,f.currency.trim())}</span></div><div className="mt-2 text-sm font-semibold">Saldo dana: {money(balance,f.currency.trim())}</div></div>;})}</div> : <p className="muted mt-4 text-sm">Belum ada dana bersama aktif.</p>}
        {pooledFunds.length>0 && <div className="mt-5 grid gap-4 border-t border-white/[.07] pt-5 xl:grid-cols-2">
          {canWrite && <div><h4 className="text-sm font-semibold">Konfirmasi iuran diterima</h4><p className="muted mt-1 text-xs">Bendahara mencatat iuran setelah pembayaran benar-benar diterima; transaksi masuk ke ledger.</p><form action={createPooledFundContributionAction} className="mt-3 space-y-2"><input type="hidden" name="workspace_id" value={active.id}/><select name="fund_id" required className="field">{pooledFunds.map(f=><option key={f.id} value={f.id}>{f.name} · {f.currency}</option>)}</select><select name="member_id" required className="field">{workspaceMembers.map(m=><option key={m.user_id} value={m.user_id}>{profileById.get(m.user_id)?.display_name ?? profileById.get(m.user_id)?.username ?? "Pengguna"} · {roleLabel(m.role)}</option>)}</select><input name="amount" type="number" min="0.01" step="0.01" required placeholder="Jumlah diterima" className="field"/><input name="notes" maxLength={240} placeholder="Catatan pembayaran (opsional)" className="field"/><button className="secondary w-full">Konfirmasi iuran diterima</button></form></div>}
          {canWrite && <div><h4 className="text-sm font-semibold">Catat pengeluaran dana</h4><p className="muted mt-1 text-xs">Pengeluaran dibatasi oleh saldo dana yang tersedia.</p><form action={createPooledFundExpenseAction} className="mt-3 space-y-2"><input type="hidden" name="workspace_id" value={active.id}/><select name="fund_id" required className="field">{pooledFunds.map(f=><option key={f.id} value={f.id}>{f.name} · {f.currency}</option>)}</select><input name="amount" type="number" min="0.01" step="0.01" required placeholder="Jumlah pengeluaran" className="field"/><input name="description" required maxLength={240} placeholder="Keterangan pengeluaran" className="field"/><button className="secondary w-full">Buku pengeluaran dana</button></form></div>}
        </div>}
        {canWrite && pooledFunds.length>0 && workspaceMembers.length>0 && <div className="mt-5 border-t border-white/[.07] pt-5"><h4 className="text-sm font-semibold">Komitmen iuran anggota</h4><p className="muted mt-1 text-xs">Status lunas dihitung dari iuran yang tercatat, bukan sekadar klaim pembayaran.</p><form action={createPooledFundCommitmentAction} className="mt-3 grid gap-2 sm:grid-cols-3"><input type="hidden" name="workspace_id" value={active.id}/><select name="fund_id" required className="field">{pooledFunds.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select><select name="member_id" required className="field">{workspaceMembers.map(m=><option key={m.user_id} value={m.user_id}>{profileById.get(m.user_id)?.display_name ?? profileById.get(m.user_id)?.username ?? "Pengguna"} · {roleLabel(m.role)}</option>)}</select><input name="amount" type="number" min="0.01" step="0.01" required placeholder="Komitmen anggota" className="field"/><button className="secondary sm:col-span-3">Simpan komitmen</button></form></div>}
        <div className="mt-5 grid gap-4 xl:grid-cols-2"><div><h4 className="text-sm font-semibold">Progress iuran anggota</h4>{pooledProgress.length?<div className="mt-2 divide-y divide-white/[.06]">{pooledProgress.map(m=>{const f=fundById.get(m.fund_id);return <div key={m.fund_id+m.member_id} className="flex flex-wrap justify-between gap-2 py-2 text-xs"><span>{f?.name??"Dana"} · {profileById.get(m.member_id)?.display_name ?? profileById.get(m.member_id)?.username ?? "Anggota"}</span><span className={m.status==="PAID"?"text-emerald-300":m.status==="OVERDUE"?"text-rose-300":"text-amber-300"}>{m.status} · {money(Number(m.paid_amount),f?.currency?.trim()??"IDR")} / {money(Number(m.committed_amount),f?.currency?.trim()??"IDR")}</span></div>})}</div>:<p className="muted mt-2 text-xs">Belum ada komitmen iuran.</p>}</div>
          <div><h4 className="text-sm font-semibold">Riwayat iuran terbaru</h4>{pooledContributions.length?<div className="mt-2 divide-y divide-white/[.06]">{pooledContributions.map(c=>{const f=fundById.get(c.fund_id);return <div key={c.id} className="flex justify-between gap-2 py-2 text-xs"><span>{f?.name??"Dana"} · {profileById.get(c.contributor_id)?.display_name ?? profileById.get(c.contributor_id)?.username ?? "Anggota"}<span className="muted block">{date(c.created_at)}{c.notes ? " · "+c.notes : ""}</span></span><span className="text-emerald-300">{money(Number(c.amount),f?.currency?.trim()??"IDR")}</span></div>})}</div>:<p className="muted mt-2 text-xs">Belum ada iuran tercatat.</p>}</div></div>
        {pooledExpenses.length>0 && <div className="mt-5 border-t border-white/[.07] pt-4"><h4 className="text-sm font-semibold">Pengeluaran dana terbaru</h4><div className="mt-2 divide-y divide-white/[.06]">{pooledExpenses.map(e=>{const f=fundById.get(e.fund_id);return <div key={e.id} className="flex justify-between gap-2 py-2 text-xs"><span>{f?.name??"Dana"} · {e.description}<span className="muted block">{date(e.created_at)}</span></span><span>{money(Number(e.amount),f?.currency?.trim()??"IDR")}</span></div>})}</div></div>}
      </section>)}


      {view === "finance" && canReadFinance && (<section className="panel mt-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-semibold">Anggaran</h3><p className="muted mt-1 text-xs">Pantau pengeluaran yang sudah dibukukan selama periode anggaran.</p></div>
          <span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400">{budgets.length} anggaran aktif</span>
        </div>
        {canWrite && <form action={createBudgetAction} className="mt-4 grid gap-3 border-b border-white/[.07] pb-5 sm:grid-cols-2">
          <input type="hidden" name="workspace_id" value={active.id}/>
          <input name="name" required maxLength={80} placeholder="Nama anggaran, mis. Operasional" className="field"/>
          <input name="amount" type="number" min="0.01" step="0.01" required placeholder="Batas anggaran" className="field"/>
          <select name="currency" className="field"><option value="IDR">IDR</option><option value="USD">USD</option><option value="MYR">MYR</option></select>
          <select name="account_id" className="field"><option value="">Semua akun dengan mata uang ini</option>{activeAccounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select>
          <label className="muted text-xs">Mulai<input name="period_start" type="date" required className="field mt-1"/></label>
          <label className="muted text-xs">Berakhir<input name="period_end" type="date" required className="field mt-1"/></label>
          <button className="secondary sm:col-span-2"><Plus size={15}/> Buat anggaran</button>
        </form>}
        {budgets.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">
          {budgets.map(b => {
            const spent = budgetSpent.get(b.id) ?? 0;
            const amount = Number(b.amount);
            const percent = amount > 0 ? Math.min(100, Math.round((spent / amount) * 100)) : 0;
            const over = spent > amount;
            return <div key={b.id} className="rounded-xl border border-white/[.08] p-4">
              <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-medium">{b.name}</div><div className="muted mt-1 text-xs">{b.period_start} – {b.period_end} · {b.currency}</div></div><div className={`text-sm font-semibold ${over ? "text-rose-300" : "text-emerald-300"}`}>{percent}%</div></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${over ? "bg-rose-400" : "bg-emerald-400"}`} style={{width:`${percent}%`}}/></div>
              <div className="muted mt-2 flex justify-between gap-2 text-xs"><span>Terpakai: {money(spent,b.currency.trim())}</span><span>Batas: {money(amount,b.currency.trim())}</span></div>
              {over && <p className="mt-2 text-xs text-rose-300">Pengeluaran melewati batas anggaran.</p>}
            </div>;
          })}
        </div> : <p className="muted mt-4 text-sm">Belum ada anggaran aktif.</p>}
      </section>)}


      {view === "reports" && ["OWNER","ADMIN","AUDITOR"].includes(role) && (<section className="panel mt-6 p-5"><h3 className="font-semibold">Aktivitas audit</h3><div className="mt-4 space-y-3">{(audit??[]).map(e=><div key={e.id} className="flex justify-between gap-3 text-xs"><span>{actionLabel(e.action)}</span><span className="muted">{date(e.created_at)}</span></div>)}{!audit?.length&&<p className="muted text-sm">Belum ada aktivitas yang tercatat.</p>}</div></section>)}
      {view === "profile" && <section className="panel mt-6 max-w-2xl p-5"><h3 className="font-semibold">Profil akun</h3><div className="mt-4 grid gap-4 sm:grid-cols-2"><div><div className="muted text-xs">Nama tampilan</div><div className="mt-1 text-sm font-medium">{ownProfile?.display_name ?? "Belum diatur"}</div></div><div><div className="muted text-xs">Username</div><div className="mt-1 text-sm font-medium">@{ownProfile?.username ?? "belum_ada"}</div></div><div><div className="muted text-xs">Email akun</div><div className="mt-1 text-sm">{user.email}</div></div><div><div className="muted text-xs">Akses workspace</div><div className="mt-1 text-sm">{roleLabel(role)}</div></div></div><p className="muted mt-5 text-xs">Kata sandi dikelola oleh Supabase Auth dan tidak disimpan dalam tabel profil PanciLedger.</p></section>}
      {view === "reports" && <section className="panel mt-6 max-w-2xl p-5"><h3 className="font-semibold">Ekspor laporan transaksi</h3><p className="muted mt-1 text-sm">Unduh transaksi yang sudah dibukukan pada ruang kerja ini dalam format CSV.</p><a className="primary mt-4" href={"/api/reports/transactions?workspace="+active.id}>Unduh laporan CSV</a></section>}
      <footer className="muted mt-8 flex justify-between gap-3 text-xs"><span>© 2026 PanciWartegX. Hak cipta dilindungi.</span><span>Data langsung dari Supabase</span></footer>
    </section>
  </main>;
}

function Brand(){return <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-emerald-400 text-slate-950"><CircleDollarSign size={23}/></div><div><div className="font-semibold">PanciLedger</div><div className="muted text-xs">by PanciWartegX</div></div></div>;}
function Metric({label,value,note,icon}:{label:string;value:string;note:string;icon:"wallet"|"in"|"out"}){const Icon=icon==="wallet"?Wallet:icon==="in"?ArrowDownLeft:ArrowUpRight;return <div className="panel min-w-0 p-5"><div className="flex items-center justify-between gap-2"><span className="muted text-sm">{label}</span><span className="rounded-xl bg-emerald-400/10 p-2 text-emerald-300"><Icon size={18}/></span></div><div className="mt-5 break-words text-xl font-semibold">{value}</div><div className="muted mt-2 text-xs">{note}</div></div>;}
