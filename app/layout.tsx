import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meditation before bed.",
  description: "Configure your meditation session",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400..700;1,400..700&family=Merriweather:ital,opsz,wght@0,18..144,300..900;1,18..144,300..900&family=Quicksand:wght@300..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans min-h-full flex flex-col">{children}</body>
    </html>
  );
}
