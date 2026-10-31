import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Your Account",
  description: "Start your 14-day free trial on Nexora. Set up your team organization and begin monitoring distributed systems in minutes.",
  alternates: {
    canonical: "/register",
  },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
