import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://panciledger.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "PanciLedger — Kelola Keuangan Lebih Teratur",
    template: "%s | PanciLedger",
  },
  description: "PanciLedger membantu mengelola akun, pemasukan, pengeluaran, dan transfer keuangan dalam satu ruang kerja.",
  applicationName: "PanciLedger",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "PanciLedger",
    locale: "id_ID",
    title: "PanciLedger — Kelola Keuangan Lebih Teratur",
    description: "Kelola akun, pemasukan, pengeluaran, dan transfer keuangan dalam satu ruang kerja.",
  },
};
 
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
