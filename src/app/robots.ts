import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/pricing",
          "/login",
          "/register",
          "/api/health",
        ],
        disallow: [
          "/dashboard/",
          "/dashboard/*",
          "/onboarding",
          "/invite/",
          "/invite/*",
          "/api/",
          "/reset-password",
          "/verify-email",
          "/forgot-password",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
