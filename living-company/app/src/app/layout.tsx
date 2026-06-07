import type { Metadata } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";

// Chunky arcade font for titles/labels; readable pixel font for body copy.
const pixelDisplay = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
});

const pixelBody = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel-body",
});

export const metadata: Metadata = {
  title: "Living Company",
  description: "A persistent AI company you can watch work — retro office, real memory.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${pixelDisplay.variable} ${pixelBody.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden bg-[#3c4a5e] text-[#3a2a1a]">{children}</body>
    </html>
  );
}
