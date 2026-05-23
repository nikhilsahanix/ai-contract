import type { Metadata } from "next";
import { Lato, EB_Garamond } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/providers/AuthProvider";
import CursorGlow from "@/components/ui/CursorGlow";

const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-lato",
  display: "swap",
});

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-eb-garamond",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ContractIQ — AI Contract Analysis for Law Firms",
  description: "Upload any contract. Instantly identify critical risks, missing clauses, and generate professional PDF redlines.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lato.variable} ${ebGaramond.variable}`}>
      <body className="font-sans antialiased bg-bg-dark text-zinc-300 selection:bg-primary-gold/20 selection:text-gold-light">
        <AuthProvider>
          <CursorGlow />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
