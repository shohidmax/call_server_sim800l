import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import AppShell from "@/components/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SIM800L ESP32 Voice & SMS Operations Cloud",
  description: "Advanced fleet management, auto-dialer, voice bridge and SMS center for ESP32 and SIM800L hardware.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var saved = localStorage.getItem('sim800l_theme');
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                var theme = saved || (prefersDark ? 'dark' : 'light');
                document.documentElement.setAttribute('data-theme', theme);
              } catch(e) {}
            `
          }}
        />
      </head>
      <body className="min-h-screen bg-base-200 text-base-content antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            <DataProvider>
              <AppShell>{children}</AppShell>
            </DataProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
