import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LeanCode | Bifrost Live Control Dashboard",
  description: "Token-Minimizing Coding Agent powered by Maxim AI's Bifrost Gateway",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090d16] text-slate-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
