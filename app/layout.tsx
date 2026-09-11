import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/lib/authContext";
import { GlobalSearchProvider } from "@/lib/globalSearchContext";
import { ToastProvider } from "@/lib/toastContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FleetLedger - Running Chart",
  description: "Digital counterpart to physical fleet running chart logbook",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper-gutter text-on-surface">
        <AuthProvider>
          <GlobalSearchProvider>
            <ToastProvider>
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </GlobalSearchProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
