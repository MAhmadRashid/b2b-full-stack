import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5000";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A0F1E",
};

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Nexora | Build smarter. Scale further.",
    template: "%s | Nexora",
  },
  description:
    "Nexora: Real-time distributed telemetry, sub-20ms edge ingestion, granular role-based access control, cryptographic API tokens, and usage-based metering for engineering teams.",
  keywords: [
    "Nexora",
    "SaaS Observability",
    "API Telemetry",
    "Distributed Tracing",
    "API Gateway Monitoring",
    "Role-Based Access Control",
    "Usage Billing Meter",
    "Next.js SaaS",
  ],
  authors: [{ name: "Nexora Engineering", url: baseUrl }],
  creator: "Nexora Systems Inc.",
  publisher: "Nexora Systems Inc.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: baseUrl,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: "Nexora Observability",
    title: "Nexora | Build smarter. Scale further.",
    description:
      "Real-time distributed telemetry, sub-20ms edge ingestion, granular role-based access control, cryptographic API tokens, and usage-based metering.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexora | Build smarter. Scale further.",
    description:
      "Real-time distributed telemetry, sub-20ms edge ingestion, granular role-based access control, and usage metering for engineering teams.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Nexora",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Cloud, Linux, Windows, macOS",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: "0",
      highPrice: "249",
      offerCount: "4",
    },
    description:
      "Enterprise observability platform providing real-time telemetry ingestion, scoped API token management, team RBAC, and usage metering.",
    url: baseUrl,
  };

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("nexora-theme")||localStorage.getItem("pulseflow-theme")||"dark";document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
