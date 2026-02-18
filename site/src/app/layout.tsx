import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.scss";

const fontPrimary = Inter({
  variable: "--font-primary",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Torph – Dependency-Free Text Morphing",
  description: "Dependency-free animated text component.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={[fontPrimary.variable].join(" ")}>{children}</body>
    </html>
  );
}
