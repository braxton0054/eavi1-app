import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
// The rebuilt stylesheet comes first so its cascade layers are declared before the
// legacy Tailwind sheet, which every unconverted screen still uses until it is ported.
import "./styles/index.css";
import "./globals.css";

import { ToastProvider } from "@/components/ui/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The `opsz` axis lets the browser redraw the name with display proportions at
// hero size instead of stretching a text-size cut.
const fraunces = Fraunces({
  variable: "--font-eavi-display",
  subsets: ["latin"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000",
  ),
  title: {
    default: "East Africa Vision Institute — Leading the Leaders",
    template: "%s | East Africa Vision Institute",
  },
  description:
    "Quality and affordable education at two campuses in Eldoret, Kenya. Apply online, then use the portal for results, class cards and campus notices.",
  applicationName: "East Africa Vision Institute",
  keywords: [
    "EAVI",
    "East Africa Vision Institute",
    "Eldoret college",
    "Kenya vocational training",
    "affordable tuition Eldoret",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "East Africa Vision Institute",
    title: "East Africa Vision Institute — Leading the Leaders",
    description:
      "Three campuses in Eldoret, Kenya. Apply online, and sign in to the portal for results and class cards.",
    locale: "en_KE",
    url: "/",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "East Africa Vision Institute logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "East Africa Vision Institute — Leading the Leaders",
    description:
      "Three campuses in Eldoret, Kenya. Apply online, and sign in to the portal for results and class cards.",
    images: ["/logo.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: "#f7f5fa",
  // Notched phones: the shell pads its own drawers with the safe-area insets.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        {/* Apply the saved theme before first paint so the switch never flashes. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('eavi-theme');var t=(s==='dark'||s==='light')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
      <ToastProvider>{children}</ToastProvider>
    </body>
    </html>
  );
}
