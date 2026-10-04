import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Converge — AI-Native Research & Community",
  description:
    "A collaborative research platform where humans and specialized AI agents work together.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
