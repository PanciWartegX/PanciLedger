import { createClient } from "@/lib/supabase/server";

const csvCell = (value: unknown) => {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
};

export async function GET(request: Request) {
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const workspace = url.searchParams.get("workspace") ?? "";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!workspace || (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) || (from && to && from > to)) {
    return new Response("Invalid report filters", { status: 400 });
  }

  const { data: membership } = await db.from("workspace_members").select("role").eq("workspace_id", workspace).eq("user_id", auth.user.id).maybeSingle();
  if (!membership) {
    return new Response("Workspace not found", {
      status: 404,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }

  // The report export is intentionally restricted to workspace owners,
  // administrators, and auditors. Hiding the menu is not authorization.
  if (!["OWNER", "ADMIN", "AUDITOR"].includes(membership.role)) {
    return new Response("Forbidden", {
      status: 403,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }

  let query = db.from("financial_transactions")
    .select("occurred_at,kind,direction,amount,currency,description,status,account_id")
    .eq("workspace_id", workspace)
    .eq("status", "POSTED")
    .order("occurred_at", { ascending: false })
    .limit(5000);
  if (from) query = query.gte("occurred_at", from + "T00:00:00.000Z");
  if (to) {
    const end = new Date(to + "T00:00:00.000Z");
    end.setUTCDate(end.getUTCDate() + 1);
    query = query.lt("occurred_at", end.toISOString());
  }
  const { data, error } = await query;
  if (error) return new Response("Unable to generate report", { status: 500 });

  const headers = ["Tanggal","Jenis","Arah","Nominal","Mata uang","Keterangan","Status","ID akun"];
  const rows = (data ?? []).map(row => [
    row.occurred_at, row.kind, row.direction, row.amount, row.currency,
    row.description, row.status, row.account_id,
  ]);
  const csv = "\uFEFF" + [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="panciledger-transactions.csv"',
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
