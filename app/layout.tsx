import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "anydrop — Anycubic cloud print",
  description: "Drop a G-code file and start printing on your Anycubic printer from anywhere.",
  applicationName: "anydrop",
};

export const viewport: Viewport = {
  themeColor: "#FEE500",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
