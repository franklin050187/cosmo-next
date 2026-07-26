import type { Metadata } from "next";
import { Suspense } from "react";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CosmoShip : Cosmoteer Library",
  description:
    "Website for sharing, searching, browsing and downloading ships design for Cosmoteer: Starship Architect & Commander.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://i.ibb.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://i.ibb.co" />
        <link rel="preconnect" href="https://ufs.sh" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://ufs.sh" />
      </head>
      <body className={`${spaceGrotesk.className} min-h-screen flex flex-col`}>
        <Suspense fallback={null}>
          <Header />
        </Suspense>
        <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 pt-[72px] pb-20">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
