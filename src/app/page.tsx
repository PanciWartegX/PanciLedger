import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CircleDollarSign, LayoutDashboard, LogOut, Plus, ShieldCheck, Wallet } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAccountAction, createAndPostTransactionAction, createTransferAction, createWorkspaceAction, reverseTransactionAction, signOutAction } from "@/app/actions";

type Props = { searchParams: Promise<{ workspace?: string; error?: string }> };
const money = (n: number, currency = "IDR") => new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
const date = (s: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(s));
const currencyTotals = (entries: { currency: string; amount: number }[]) => {
  const totals = new Map<string, number>();
  for (const entry of entries) totals.set(entry.currency.trim(), (totals.get(entry.currency.trim()) ?? 0) + entry.amount);
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => money(amount, currency)).join(" · ") || money(0);
};

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await db.from("workspace_members").select("workspace_id,role").eq("user_id", user.id);
  const rows = memberships ?? [];
  const ids = rows.map((m) => m.workspace_id);
  const { data: spaces } = ids.length ? await db.from("workspaces").select("id,name").in("id", ids) : { data: [] as {id:string;name:string}[] };
  const workspaces = spaces ?? [];
  const active = workspaces.find((w) => w.id === params.workspace) ?? workspaces[0];
  if (!active) return <main className="grid min-h-screen place-items-center px-5"><section className="panel w-full max-w-lg p-8"><Brand/><h1 className="mt-8 text-2xl font-semibold">Create your first workspace</h1><p className="muted mt-2 text-sm">A separate place for each set of accounts and members.</p><form action={createWorkspaceAction} className="mt-6 space-y-3"><input name="name" required maxLength={80} placeholder="Personal finance" className="field"/><button className="primary w-full"><Plus size={16}/> Create workspace</button></form><form action={signOutAction} className="mt-5"><button className="muted text-sm">Sign out</button></form></section></main>;

  const role = rows.find((m) => m.workspace_id === active.id)?.role ?? "VIEWER";
  const canWrite = ["OWNER","ADMIN","TREASURER"].includes(role);
  const [{ data: accounts }, { data: transactions }, { data: audit }] = await Promise.all([
    db.from("workspace_account_balances").select("id,name,currency,current_balance,is_active").eq("workspace_id", active.id).order("created_at"),
    db.from("financial_transactions").select("id,kind,amount,currency,description,occurred_at,direction").eq("workspace_id", active.id).eq("status", "POSTED").order("occurred_at", {ascending:false}).limit(12),
    db.from("workspace_audit_log").select("id,action,created_at").eq("workspace_id", active.id).order("created_at", {ascending:false}).limit(6),
  ]);
  const accts = accounts ?? [];
  const txs = transactions ?? [];
  const totalByCurrency = accts.map(a => ({ currency: a.currency, amount: Number(a.current_balance) }));
  const inflows = txs.filter(t => t.direction === "IN").map(t => ({ currency: t.currency, amount: Number(t.amount) }));
  const outflows = txs.filter(t => t.direction === "OUT").map(t => ({ currency: t.currency, amount: Number(t.amount) }));
  const activeAccounts = accts.filter(a=>a.is_active);

  return <main className="min-h-screen lg:flex">
    <aside className="hidden w-64 shrink-0 border-r border-white/[.07] px-5 py-7 lg:flex lg:flex-col"><Brand/><div className="mt-10 text-[10px] uppercase tracking-[.2em] text-slate-500">Workspace</div><form action="/" method="get" className="mt-3 space-y-2"><select name="workspace" defaultValue={active.id} className="field">{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><button className="secondary w-full text-xs">Switch workspace</button></form><div className="mt-4 rounded-xl border border-white/10 p-3"><div className="text-sm font-medium">{active.name}</div><div className="muted mt-1 text-xs">{role} access</div></div><nav className="mt-8 space-y-4 text-sm text-slate-400"><div className="flex items-center gap-3 text-emerald-300"><LayoutDashboard size={17}/> Overview</div><div className="flex items-center gap-3"><Wallet size={17}/> Accounts</div><div className="flex items-center gap-3"><ArrowLeftRight size={17}/> Transactions</div></nav><div className="mt-auto rounded-xl border border-emerald-400/15 bg-emerald-400/[.05] p-4"><div className="flex items-center gap-2 text-sm text-emerald-200"><ShieldCheck size={16}/> RLS protected</div><p className="muted mt-2 text-xs">Workspace access is checked in PostgreSQL.</p></div><form action={signOutAction} className="mt-5"><button className="muted flex items-center gap-2 text-sm"><LogOut size={15}/> Sign out</button></form></aside>
    <section className="min-w-0 flex-1 px-5 py-6 md:px-8 lg:px-10">
      <header className="flex flex-wrap items-center justify-between gap-3"><div><div className="muted text-xs">{user.email}</div><h1 className="mt-1 text-xl font-semibold">Workspace overview</h1></div><span className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400">{role}</span></header>
      <form action="/" method="get" className="mt-4 flex gap-2 lg:hidden"><select name="workspace" defaultValue={active.id} className="field flex-1">{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><button className="secondary shrink-0">Switch</button></form>
      {params.error && <p role="alert" className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/5 p-3 text-sm text-rose-200">Action failed: {params.error}. Check permissions and confirm database migrations are applied.</p>}
      <div className="mt-8"><div className="muted text-sm">{active.name}</div><h2 className="mt-1 text-2xl font-semibold">Your finances at a glance</h2><p className="muted mt-2 text-sm">Live balances from posted ledger entries.</p></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3"><Metric label="Total balance" value={currencyTotals(totalByCurrency)} note={`${accts.length} accounts · grouped by currency`} icon="wallet"/><Metric label="Cash inflow · latest 12" value={currencyTotals(inflows)} note="Includes transfers and reversals" icon="in"/><Metric label="Cash outflow · latest 12" value={currencyTotals(outflows)} note="Includes transfers and reversals" icon="out"/></div>
      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <section className="panel p-5"><h3 className="font-semibold">Accounts</h3><p className="muted mt-1 text-xs">Calculated balances</p>{accts.length ? <div className="mt-4 divide-y divide-white/[.06]">{accts.map(a=><div key={a.id} className="flex justify-between gap-3 py-3"><div><div className="text-sm font-medium">{a.name}</div><div className="muted text-xs">{a.currency} · {a.is_active?"Active":"Archived"}</div></div><div className="text-sm font-semibold">{money(Number(a.current_balance),a.currency.trim())}</div></div>)}</div>:<p className="muted mt-4 text-sm">No accounts yet.</p>}
          {canWrite && <form action={createAccountAction} className="mt-5 grid gap-3 border-t border-white/[.07] pt-5 sm:grid-cols-2"><input type="hidden" name="workspace_id" value={active.id}/><input name="name" required maxLength={80} placeholder="Account name" className="field"/><input name="opening_balance" required inputMode="decimal" defaultValue="0" placeholder="Opening balance" className="field"/><select name="currency" className="field"><option value="IDR">IDR</option><option value="USD">USD</option><option value="MYR">MYR</option></select><button className="secondary"><Plus size={15}/> Create account</button></form>}
        </section>
        <section className="panel p-5"><h3 className="font-semibold">Recent transactions</h3><p className="muted mt-1 text-xs">Latest posted ledger activity</p>{txs.length?<div className="mt-4 divide-y divide-white/[.06]">{txs.map(t=><div key={t.id} className="flex items-start justify-between gap-2 py-3"><div className="min-w-0"><div className="truncate text-sm font-medium">{t.description}</div><div className="muted mt-1 text-xs">{t.kind} · {date(t.occurred_at)}</div></div><div className={`shrink-0 text-sm font-semibold ${t.direction==="IN"?"text-emerald-300":"text-slate-200"}`}>{t.direction==="IN"?"+":"−"} {money(Number(t.amount),t.currency.trim())}</div>{canWrite && !["REVERSAL","TRANSFER"].includes(t.kind) && <form action={reverseTransactionAction}><input type="hidden" name="workspace_id" value={active.id}/><input type="hidden" name="transaction_id" value={t.id}/><button className="muted text-[10px] underline">Reverse</button></form>}</div>)}</div>:<p className="muted mt-4 text-sm">No posted transactions yet.</p>}</section>
      </div>
      {canWrite && <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <section id="new-transaction" className="panel p-5"><h3 className="font-semibold">New transaction</h3><p className="muted mt-1 text-xs">Draft then validated posting</p>{activeAccounts.length?<form action={createAndPostTransactionAction} className="mt-4 space-y-3"><input type="hidden" name="workspace_id" value={active.id}/><select name="account_id" className="field">{activeAccounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select><div className="grid grid-cols-2 gap-3"><select name="kind" className="field"><option value="INCOME">Income</option><option value="EXPENSE">Expense</option></select><input name="amount" required inputMode="decimal" placeholder="Amount" className="field"/></div><input name="description" required maxLength={240} placeholder="Description" className="field"/><button className="primary w-full">Save and post</button></form>:<p className="muted mt-4 text-sm">Create an active account first.</p>}</section>
        <section className="panel p-5"><h3 className="font-semibold">Transfer funds</h3><p className="muted mt-1 text-xs">Two-sided transfer committed atomically</p>{activeAccounts.length>=2?<form action={createTransferAction} className="mt-4 space-y-3"><input type="hidden" name="workspace_id" value={active.id}/><select name="source_account" className="field">{activeAccounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select><select name="destination_account" className="field">{activeAccounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select><input name="amount" required inputMode="decimal" placeholder="Amount" className="field"/><input name="description" required maxLength={240} placeholder="Description" className="field"/><button className="secondary w-full"><ArrowLeftRight size={16}/> Transfer</button></form>:<p className="muted mt-4 text-sm">Create two active accounts in the same currency.</p>}</section>
      </div>}
      {["OWNER","ADMIN","AUDITOR"].includes(role) && <section className="panel mt-6 p-5"><h3 className="font-semibold">Audit activity</h3><div className="mt-4 space-y-3">{(audit??[]).map(e=><div key={e.id} className="flex justify-between gap-3 text-xs"><span>{e.action.replaceAll("_"," ")}</span><span className="muted">{date(e.created_at)}</span></div>)}{!audit?.length&&<p className="muted text-sm">No events recorded yet.</p>}</div></section>}
      <footer className="muted mt-8 flex justify-between gap-3 text-xs"><span>© 2026 PanciWartegX. All rights reserved.</span><span>Supabase live data</span></footer>
    </section>
  </main>;
}

function Brand(){return <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-emerald-400 text-slate-950"><CircleDollarSign size={23}/></div><div><div className="font-semibold">PanciLedger</div><div className="muted text-xs">by PanciWartegX</div></div></div>;}
function Metric({label,value,note,icon}:{label:string;value:string;note:string;icon:"wallet"|"in"|"out"}){const Icon=icon==="wallet"?Wallet:icon==="in"?ArrowDownLeft:ArrowUpRight;return <div className="panel min-w-0 p-5"><div className="flex items-center justify-between gap-2"><span className="muted text-sm">{label}</span><span className="rounded-xl bg-emerald-400/10 p-2 text-emerald-300"><Icon size={18}/></span></div><div className="mt-5 break-words text-xl font-semibold">{value}</div><div className="muted mt-2 text-xs">{note}</div></div>;}
