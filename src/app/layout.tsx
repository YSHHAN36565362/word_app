import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { FocusModeProvider } from "@/contexts/FocusModeContext";
import BottomNav from "@/components/BottomNav";
import PageTransition from "@/components/PageTransition";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-noto-sans-kr",
  display: "swap",
});

export const metadata: Metadata = {
  title: "단어장",
  description: "매일 조금씩, 확실하게 외우기",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "단어장",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f13" },
  ],
};

const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem('word_app_theme');
  if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col" style={{ fontFamily: "var(--font-noto-sans-kr), sans-serif" }}>
        <ThemeProvider>
          <FocusModeProvider>
            <main className="flex-1 pb-24">
              <PageTransition>{children}</PageTransition>
            </main>
            <BottomNav />
          </FocusModeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
