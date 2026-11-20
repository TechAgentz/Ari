import type { Metadata, Viewport } from "next";
import { Inter, Lora } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { Onboarding } from "@/components/onboarding";
import { ThemeSync } from "@/components/theme-sync";
import { ToastProvider } from "@/components/ui/toast";
import { APP } from "@/lib/config";
import { SETTINGS_KEY } from "@/lib/storage-keys";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${APP.name} — virtual care assistant (demo)`, template: `%s · ${APP.name}` },
  description: "An interactive demo of Ari, a calm, private virtual care assistant. Not a medical or diagnostic tool.",
  robots: { index: false, follow: false },
  applicationName: APP.name,
  // Opens full-screen when added to an iPhone home screen.
  appleWebApp: { capable: true, title: APP.name, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1716" },
  ],
};

// Applies the saved theme before first paint to avoid a flash.
const themeScript = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_KEY)})||"{}");var t=s.theme||"light";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${lora.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-bg font-sans text-fg antialiased">
        <ToastProvider>
          <AppShell>{children}</AppShell>
          <Onboarding />
          <ThemeSync />
        </ToastProvider>
      </body>
    </html>
  );
}
