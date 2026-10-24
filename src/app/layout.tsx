import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "PulseFlow | Enterprise Observability & SaaS Cloud Engine",
  description:
    "Real-time distributed telemetry, granular role-based access control, high-throughput API gateway keys, and usage-based monetization for modern engineering teams.",
  keywords: [
    "SaaS",
    "Observability",
    "Telemetry",
    "API Gateway",
    "Role-Based Access Control",
    "Enterprise Analytics",
    "Next.js SaaS",
  ],
  authors: [{ name: "PulseFlow Engineering" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
