import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL = "http://localhost:5000";

test("Phase 16 Integration: GET /robots.txt serves valid directives and disallows private routes", async () => {
  const res = await fetch(`${BASE_URL}/robots.txt`);
  assert.equal(res.status, 200);
  const text = await res.text();

  assert.ok(text.toLowerCase().includes("user-agent: *"));
  assert.ok(text.includes("Disallow: /dashboard"));
  assert.ok(text.includes("Disallow: /onboarding"));
  assert.ok(text.includes("Disallow: /api/"));
  assert.ok(text.includes("Allow: /"));
  assert.ok(text.includes("Allow: /pricing"));
  assert.ok(text.includes("Sitemap: http://localhost:5000/sitemap.xml"));
});

test("Phase 16 Integration: GET /sitemap.xml serves valid XML sitemap with public routes", async () => {
  const res = await fetch(`${BASE_URL}/sitemap.xml`);
  assert.equal(res.status, 200);
  const text = await res.text();

  assert.ok(text.includes("<urlset"));
  assert.ok(text.includes("<loc>http://localhost:5000</loc>"));
  assert.ok(text.includes("<loc>http://localhost:5000/pricing</loc>"));
  assert.ok(text.includes("<loc>http://localhost:5000/register</loc>"));
  assert.ok(text.includes("<loc>http://localhost:5000/login</loc>"));
  // Ensure private routes are NOT in sitemap
  assert.ok(!text.includes("/dashboard"));
  assert.ok(!text.includes("/onboarding"));
});

test("Phase 16 Integration: GET / returns HTML with SEO metadata, JSON-LD, and openGraph", async () => {
  const res = await fetch(`${BASE_URL}`);
  assert.equal(res.status, 200);
  const html = await res.text();

  assert.ok(
    html.includes("Nexora | Build smarter. Scale further.") ||
    html.includes("PulseFlow | Enterprise Observability &amp; SaaS Telemetry Engine") ||
    html.includes("PulseFlow | Enterprise Observability & SaaS Telemetry Engine")
  );
  assert.ok(html.includes("application/ld+json"));
  assert.ok(html.includes("SoftwareApplication"));
  assert.ok(html.includes('canonical" href="http://localhost:5000"'));
  assert.ok(html.includes("Terms of Service"));
  assert.ok(html.includes("Privacy Policy"));
  assert.ok(html.includes("Prisma SQLite WAL"));
});

test("Phase 16 Integration: GET /pricing returns HTML with page-specific title and canonical", async () => {
  const res = await fetch(`${BASE_URL}/pricing`);
  assert.equal(res.status, 200);
  const html = await res.text();

  assert.ok(
    html.includes("Pricing Plans &amp; Usage Quotas | Nexora") ||
    html.includes("Pricing Plans & Usage Quotas | Nexora") ||
    html.includes("Pricing Plans &amp; Usage Quotas | PulseFlow") ||
    html.includes("Pricing Plans & Usage Quotas | PulseFlow")
  );
  assert.ok(html.includes('canonical" href="http://localhost:5000/pricing"'));
});

test("Phase 16 Integration: GET /register returns HTML with page-specific title and canonical", async () => {
  const res = await fetch(`${BASE_URL}/register`);
  assert.equal(res.status, 200);
  const html = await res.text();

  assert.ok(
    html.includes("Create Your Account | Nexora") ||
    html.includes("Create Your Account | PulseFlow")
  );
  assert.ok(html.includes('canonical" href="http://localhost:5000/register"'));
});
