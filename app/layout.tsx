import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "INHERIX | Secure Digital Continuity",
  description: "Secure digital continuity and controlled release for families and trusted advisors.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
