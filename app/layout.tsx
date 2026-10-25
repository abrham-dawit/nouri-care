import type { Metadata, Viewport } from "next";
import { Fraunces, Noto_Sans_Arabic, Noto_Sans_Ethiopic, Plus_Jakarta_Sans } from "next/font/google";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { INTRO_BOOT_SCRIPT } from "@/components/nouri/intro-preference";
import { MISSION } from "@/lib/site";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

// Script coverage for Ge'ez (Amharic, Tigrinya, Oromo in Ethiopic) and Arabic-script languages.
// Not preloaded: the browser only fetches them when such text appears.
const ethiopic = Noto_Sans_Ethiopic({ variable: "--font-ethiopic", subsets: ["ethiopic"], preload: false });
const arabic = Noto_Sans_Arabic({ variable: "--font-arabic", subsets: ["arabic"], preload: false });

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});

export const metadata: Metadata = {
  title: {
    default: "Nouri Care — Care that remembers",
    template: "%s · Nouri Care",
  },
  description: `${MISSION} Nouri is a friendly companion robot for older adults, with a care platform for clinicians and families.`,
};

export const viewport: Viewport = {
  themeColor: "#050a15",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} ${fraunces.variable} ${ethiopic.variable} ${arabic.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Decides before first paint whether the intro plays, so there is never a flash of the page. */}
        <script dangerouslySetInnerHTML={{ __html: INTRO_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only z-[200] rounded-full bg-glow-300 px-4 py-2 font-semibold text-night-950 focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
