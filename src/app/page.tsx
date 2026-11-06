import { ArrowDownLeft, ArrowUpRight, Bell, ChevronDown, CircleDollarSign, LayoutDashboard, Plus, Search, Settings2, ShieldCheck, Wallet, ArrowLeftRight, ChartNoAxesCombined } from "lucide-react";

const nav = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Transactions", icon: ArrowLeftRight },
  { label: "Accounts", icon: Wallet },
  { label: "Budgets", icon: ChartNoAxesCombined },
];

const transactions = [
  { title: "Project payment", category: "Client revenue", date: "Today, 10:42", amount: "+ Rp 8.500.000", income: true, initials: "PP" },
  { title: "Workspace supplies", category: "Operations", date: "Yesterday, 15:20", amount: "− Rp 1.250.000", income: false, initials: "WS" },
  { title: "Monthly contribution", category: "Shared fund", date: "06 Nov 2026", amount: "+ Rp 750.000", income: true, initials: "MC" },
];

function Metric({ label, value, note, icon: Icon, positive }: { label: string; value: string; note: string; icon: typeof Wallet; positive?: boolean }) {
  return <div className="panel p-5">
    <div className="flex items-center justify-between"><span className="muted text-sm">{label}</span><span className="rounded-xl bg-emerald-400/10 p-2 text-emerald-300"><Icon size={18}/></span></div>
    <div className="mt-5 text-2xl font-semibold tracking-tight">{value}</div>
    <div className="mt-2 text-xs"><span className={positive ? "text-emerald-300" : "muted"}>{note}</span></div>
  </div>;
}

export default function Home() {
  return <main className="min-h-screen lg:flex">
    <aside className="hidden w-64 shrink-0 border-r border-white/[.07] px-5 py-7 lg:flex lg:flex-col">
      <div className="flex items-center gap-3 px-2"><div className="grid size-10 place-items-center rounded-xl bg-emerald-400 text-slate-950"><CircleDollarSign size={23}/></div><div><div className="font-semibold tracking-wide">PanciLedger</div><div className="muted text-xs">by PanciWartegX</div></div></div>
      <div className="mt-10 px-2 text-[10px] font-semibold uppercase tracking-[.2em] text-slate-500">Workspace</div>
      <button className="mt-3 flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[.04] p-3 text-left text-sm"><span><span className="block font-medium">Personal workspace</span><span className="muted mt-1 block text-xs">Owner access</span></span><ChevronDown size={16} className="muted"/></button>
      <div className="mt-9 px-2 text-[10px] font-semibold uppercase tracking-[.2em] text-slate-500">Menu</div>
      <nav className="mt-3 space-y-1">{nav.map(({label,icon:Icon,active})=><a key={label} href="#" className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${active ? "bg-emerald-400/10 font-medium text-emerald-300" : "text-slate-400 hover:bg-white/[.04] hover:text-slate-100"}`}><Icon size={18}/>{label}</a>)}</nav>
      <div className="mt-auto rounded-2xl border border-emerald-400/15 bg-emerald-400/[.06] p-4"><div className="flex items-center gap-2 text-sm font-medium text-emerald-200"><ShieldCheck size={16}/> Your data, protected</div><p className="muted mt-2 text-xs leading-5">Workspace isolation and secure access controls are part of the foundation.</p></div>
      <div className="mt-5 flex items-center gap-3 px-2 text-sm text-slate-400"><Settings2 size={17}/> Settings</div>
    </aside>
    <section className="min-w-0 flex-1 px-5 py-6 md:px-8 lg:px-10">
      <header className="flex items-center justify-between gap-4"><div><div className="muted text-xs">Friday, 7 November 2026</div><h1 className="mt-1 text-xl font-semibold">Good morning 👋</h1></div><div className="flex items-center gap-3"><button aria-label="Search" className="rounded-xl border border-white/10 p-2.5 text-slate-400"><Search size={18}/></button><button aria-label="Notifications" className="relative rounded-xl border border-white/10 p-2.5 text-slate-400"><Bell size={18}/><span className="absolute right-2 top-2 size-1.5 rounded-full bg-emerald-400"/></button><div className="grid size-10 place-items-center rounded-full bg-slate-700 text-sm font-semibold">PW</div></div></header>
      <div className="mt-9 flex flex-wrap items-end justify-between gap-4"><div><div className="muted text-sm">Workspace overview</div><h2 className="mt-1 text-2xl font-semibold">Your finances at a glance</h2><p className="muted mt-2 text-sm">A clear picture of what comes in and goes out.</p></div><button className="flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-950/30"><Plus size={17}/> Add transaction</button></div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total balance" value="Rp 24.850.000" note="Across 3 accounts" icon={Wallet}/>
        <Metric label="Total income" value="Rp 12.400.000" note="↑ 8.2% from last month" icon={ArrowDownLeft} positive/>
        <Metric label="Total expenses" value="Rp 4.250.000" note="↓ 3.1% from last month" icon={ArrowUpRight}/>
        <Metric label="Available budget" value="Rp 6.750.000" note="68% of monthly limit" icon={ChartNoAxesCombined} positive/>
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <div className="panel p-5 md:p-6"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Cash flow</h3><p className="muted mt-1 text-xs">Income vs expenses</p></div><button className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Last 7 days <ChevronDown className="ml-2 inline" size={13}/></button></div><div className="mt-8 flex h-44 items-end justify-between gap-3 px-2">{[38,58,44,78,52,88,66].map((v,i)=><div key={i} className="flex h-full flex-1 flex-col justify-end gap-2"><div className="flex h-full items-end justify-center gap-1"><div className="w-2/5 rounded-t-md bg-emerald-400/80" style={{height:v+"%"}}/><div className="w-2/5 rounded-t-md bg-sky-400/60" style={{height:(v*.52)+"%"}}/></div><span className="muted text-center text-[10px]">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]}</span></div>)}</div><div className="mt-5 flex gap-5 text-xs text-slate-400"><span><i className="mr-2 inline-block size-2 rounded-full bg-emerald-400"/>Income</span><span><i className="mr-2 inline-block size-2 rounded-full bg-sky-400"/>Expenses</span></div></div>
        <div className="panel p-5 md:p-6"><div className="flex items-center justify-between"><h3 className="font-semibold">Account balances</h3><a href="#" className="text-xs text-emerald-300">View all</a></div><div className="mt-5 space-y-5">{[{name:"Main wallet",type:"Cash",amount:"Rp 12.500.000",pct:"52%"},{name:"Bank account",type:"Savings",amount:"Rp 9.850.000",pct:"40%"},{name:"Emergency fund",type:"Reserve",amount:"Rp 2.500.000",pct:"8%"}].map((a)=><div key={a.name}><div className="flex items-center justify-between"><div><div className="text-sm font-medium">{a.name}</div><div className="muted mt-1 text-xs">{a.type}</div></div><div className="text-right text-sm font-medium">{a.amount}</div></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-emerald-400" style={{width:a.pct}}/></div></div>)}</div></div>
      </div>
      <div className="panel mt-5 p-5 md:p-6"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Recent transactions</h3><p className="muted mt-1 text-xs">Your latest workspace activity</p></div><a href="#" className="text-xs text-emerald-300">See all</a></div><div className="mt-5 divide-y divide-white/[.06]">{transactions.map(t=><div key={t.title} className="flex items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"><div className="flex min-w-0 items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[.05] text-xs font-semibold text-slate-300">{t.initials}</div><div className="min-w-0"><div className="truncate text-sm font-medium">{t.title}</div><div className="muted mt-1 text-xs">{t.category} · {t.date}</div></div></div><div className={`shrink-0 text-sm font-semibold ${t.income ? "text-emerald-300" : "text-slate-200"}`}>{t.amount}</div></div>)}</div></div>
      <footer className="muted mt-8 flex flex-wrap justify-between gap-2 text-xs"><span>© 2026 PanciWartegX. All rights reserved.</span><span>Preview interface · Sample data only</span></footer>
    </section>
  </main>;
}