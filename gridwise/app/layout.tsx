import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-body" });
const sora = Sora({
  subsets: ["latin"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "GridWise - Smart Energy Sharing Network",
  description: "AI-powered smart energy forecasting, trading, and optimization for Karnataka neighborhoods.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${sora.variable}`}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
