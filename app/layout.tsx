import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://m2canada.ca"),

  title: {
    default: "M2 Canada",
    template: "%s | M2 Canada",
  },

  description:
    "Transport Canada AME M2 exam preparation. Practice questions, study mode, and realistic mock exams.",

  applicationName: "M2 Canada",

  keywords: [
    "M2 Canada",
    "AME",
    "Transport Canada",
    "Aircraft Maintenance Engineer",
    "M2 Exam",
    "Aircraft Maintenance",
    "Aviation",
  ],

  authors: [{ name: "M2 Canada" }],
  creator: "M2 Canada",

  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },

  manifest: "/manifest.webmanifest",

  appleWebApp: {
    capable: true,
    title: "M2 Canada",
    statusBarStyle: "black-translucent",
  },

  openGraph: {
    title: "M2 Canada",
    description:
      "Transport Canada AME M2 exam preparation with hundreds of practice questions.",
    url: "https://m2canada.ca",
    siteName: "M2 Canada",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e3a8a" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
