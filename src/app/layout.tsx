import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "SchoolFlow" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
