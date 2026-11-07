"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { month: string; income: number; expense: number };
type Series = { currency: string; points: Point[] };

export function FinanceCharts({ series }: { series: Series[] }) {
  if (!series.length) return <section className="panel mt-6 p-5"><h3 className="font-semibold">Tren arus kas</h3><p className="muted mt-2 text-sm">Belum ada transaksi untuk ditampilkan.</p></section>;
  return <section className="panel mt-6 p-5">
    <div><h3 className="font-semibold">Tren arus kas</h3><p className="muted mt-1 text-xs">Pemasukan dan pengeluaran bulanan dari transaksi yang dibukukan, dipisahkan per mata uang</p></div>
    <div className="mt-4 grid gap-5 xl:grid-cols-2">
      {series.map(item => <div key={item.currency} className="min-w-0 rounded-xl border border-white/[.07] p-3">
        <div className="mb-2 text-sm font-medium">{item.currency}</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={item.points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="currentColor" opacity={0.12} vertical={false}/>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value:number)=>new Intl.NumberFormat("id-ID",{notation:"compact",maximumFractionDigits:1}).format(value)}/>
            <Tooltip formatter={(value)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:item.currency,maximumFractionDigits:0}).format(Number(value))}/>
            <Legend wrapperStyle={{fontSize:12}}/>
            <Bar dataKey="income" name="Pemasukan" fill="#34d399" radius={[4,4,0,0]}/>
            <Bar dataKey="expense" name="Pengeluaran" fill="#64748b" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>)}
    </div>
  </section>;
}
