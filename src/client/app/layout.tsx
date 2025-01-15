import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const primaryFont = Space_Grotesk({
  weight: "variable",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VEX Software UI",
  description: "By Nathan and Ethan",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${primaryFont.className} antialiased`}>{children}</body>
    </html>
  );
}
