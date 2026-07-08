import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

  openGraph: {
    title: "M2 Canada",
    description:
      "Transport Canada AME M2 exam preparation with hundreds of practice questions.",
    url: "https://m2canada.ca",
    siteName: "M2 Canada",
    type: "website",
  },
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
