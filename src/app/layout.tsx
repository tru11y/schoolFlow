import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "SchoolFlow" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Browser extensions inject attributes on <html>/<body> before hydration; ignore those benign mismatches.
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-dvh antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
