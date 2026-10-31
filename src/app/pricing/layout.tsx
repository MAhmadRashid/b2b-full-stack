import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing Plans & Usage Quotas",
  description: "Transparent, usage-based tiers for engineering teams of all sizes. Scale smoothly from free developer sandbox to enterprise multi-tenant infrastructure.",
  alternates: {
    canonical: "/pricing",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
