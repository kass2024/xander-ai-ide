import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Xander AI IDE - AI Coding Assistant",
  description: "AI-powered coding IDE with intelligent autocomplete, chat, and multi-file editing. Build faster with Xander AI assistance.",
  keywords: ["AI IDE", "Xander AI IDE", "coding assistant", "autocomplete", "AI chat", "programming"],
  authors: [{ name: "Xander AI" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://xander-ai-ide.com",
    title: "Xander AI IDE - AI-Powered Coding Assistant",
    description: "Build code faster with AI-powered autocomplete, chat, and multi-file editing.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} font-sans`}>
      <body className="min-h-screen bg-background antialiased">
        {children}
      </body>
    </html>
  );
}
