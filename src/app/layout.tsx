import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PanciLedger — Financial Workspace",
  description: "A clear, secure workspace for managing money together.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}