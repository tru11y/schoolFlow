import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/presentation/components/theme-provider";
import { ServiceWorkerRegister } from "@/presentation/components/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "SchoolFlow",
  applicationName: "SchoolFlow",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "SchoolFlow" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#111115" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Browser extensions inject attributes on <html>/<body> before hydration; ignore those benign mismatches.
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-dvh antialiased" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
