import type { Metadata, Viewport } from "next";
import "@/styles/globals.scss";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "Torph – Dependency-Free Text Morphing",
  description: "Dependency-free animated text component.",
  openGraph: {
    type: "website",
    url: "https://torph.lochie.me",
    siteName: "Torph",
    title: "Torph – Dependency-Free Text Morphing",
    description: "Dependency-free animated text component.",
  },
  twitter: {
    card: "summary_large_image",
    site: "@lochieaxon",
    creator: "@lochieaxon",
    title: "Torph",
    description: "Dependency-free animated text component.",
  },
  other: {
    "msapplication-navbutton-color": "#000000",
    "apple-mobile-web-app-status-bar-style": "#000000",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
