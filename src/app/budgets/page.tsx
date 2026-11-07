import { FinanceApp } from "@/components/finance-app";

type Props = {
  searchParams: Promise<{
    workspace?: string;
    error?: string;
    invite?: string;
    accept_invite?: string;
    view?: string;
    profile_updated?: string;
  }>;
};

export default function BudgetsPage({ searchParams }: Props) {
  return <FinanceApp searchParams={searchParams} forcedView="budgets" />;
}
