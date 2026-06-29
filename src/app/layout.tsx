import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "chapter3five",
  description: "Rebuilding.",
  metadataBase: new URL("https://chapter3five.app"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-ink text-warm-50">
        {children}
      </body>
    </html>
  );
}
