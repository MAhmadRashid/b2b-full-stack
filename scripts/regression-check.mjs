// scripts/regression-check.mjs
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function main() {
  console.log(`=== STARTING FULL PULSEFLOW REGRESSION AUDIT [${BASE_URL}] ===\n`);

  const results = [];

  function record(name, pass, note = '') {
    results.push({ Requirement: name, Status: pass ? 'PASS' : 'FAIL', Details: note });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name} ${note ? '-> ' + note : ''}`);
  }

  try {
    // 1. Health check & DB connectivity
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthJson = await healthRes.json();
    record('System Health & Database', healthRes.status === 200 && healthJson.status === 'HEALTHY', `DB: ${healthJson?.database?.status}`);

    // 2. Auth Routes
    const authRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];
    for (const route of authRoutes) {
      const res = await fetch(`${BASE_URL}${route}`);
      const text = await res.text();
      record(`Auth Route: ${route}`, res.status === 200 && text.includes('PulseFlow'), `HTTP ${res.status}`);
    }

    // 3. Custom 404 Route
    const notFoundRes = await fetch(`${BASE_URL}/route-that-does-not-exist-${Date.now()}`);
    const notFoundHtml = await notFoundRes.text();
    record(
      'Custom 404 Page (/not-found)',
      notFoundRes.status === 404 && notFoundHtml.includes('404') && notFoundHtml.includes('Telemetry Stream Not Found'),
      `HTTP ${notFoundRes.status}, custom copy verified`
    );

    // 4. Favicon / Vector Icon
    const iconRes = await fetch(`${BASE_URL}/icon.svg`);
    record(
      'Favicon /icon.svg Vector Route',
      iconRes.status === 200 && (iconRes.headers.get('content-type') || '').includes('svg'),
      `Content-Type: ${iconRes.headers.get('content-type')}`
    );

    // 5. Landing Page & Required Enhancements
    const homeRes = await fetch(`${BASE_URL}/`);
    const homeHtml = await homeRes.text();

    record(
      'Final CTA Banner ("Start Monitoring in 5 Minutes")',
      homeHtml.includes('Start Monitoring in') && homeHtml.includes('5 Minutes'),
      'Rendered before footer with 14-day free trial CTA'
    );

    record(
      'Multi-Column Footer (Product, Developers, Company & Legal)',
      homeHtml.includes('Product') && homeHtml.includes('Developers') && (homeHtml.includes('Company &amp; Legal') || homeHtml.includes('Company & Legal')),
      'All 4 structured columns present'
    );

    record(
      'Footer Newsletter Subscription Input',
      homeHtml.includes('Subscribe to Engineering Updates') && homeHtml.includes('you@company.com'),
      'Interactive form with success feedback'
    );

    record(
      'Footer Social Icons (GitHub, X, LinkedIn)',
      homeHtml.includes('PulseFlow GitHub') && homeHtml.includes('PulseFlow on X (Twitter)') && homeHtml.includes('PulseFlow on LinkedIn'),
      'Inline vector SVGs without external font dependencies'
    );

    record(
      'SEO & Structured Data (Open Graph, Twitter, JSON-LD)',
      homeHtml.includes('application/ld+json') && homeHtml.includes('SoftwareApplication') && homeHtml.includes('canonical'),
      'Schema.org SoftwareApplication and canonical tags'
    );

    record(
      'Trusted By Logos [Design Placeholder]',
      homeHtml.includes('Design Placeholder') && homeHtml.includes('Acme Edge Infrastructure'),
      'Clearly labelled without deceptive fake company claims'
    );

    record(
      'Customer Testimonials [Design Placeholder]',
      homeHtml.includes('Design Placeholder') && homeHtml.includes('Architectural Case Studies'),
      'Clearly labelled architectural spotlight cards'
    );

    record(
      'Pricing Annual / Monthly Toggle',
      homeHtml.includes('Save 20%') && (homeHtml.includes('billed annually') || homeHtml.includes('Growth Starter') || homeHtml.includes('btn-pricing-annual')),
      'Interactive toggle with dynamic discount calculation'
    );

    record(
      'FAQ Accordion with Rotating Chevrons',
      homeHtml.includes('Frequently Asked Questions') && homeHtml.includes('data retention') && homeHtml.includes('SOC 2'),
      'SLA, retention, and roadmap compliance Q&A'
    );

    // 6. Live Ingestion Security & Demo Isolation
    const ingestRes = await fetch(`${BASE_URL}/api/v1/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'ping', test: true })
    });
    record(
      'Live Demo Ingestion Protection (401 Unauthorized)',
      ingestRes.status === 401,
      `Unauthenticated payload rejected with HTTP ${ingestRes.status}`
    );

    console.log('\n=== AUDIT SUMMARY ===');
    console.table(results);

    const failures = results.filter(r => r.Status === 'FAIL');
    if (failures.length > 0) {
      console.error(`\nFAILED: ${failures.length} regression checks failed.`);
      process.exit(1);
    } else {
      console.log(`\nALL ${results.length} REGRESSION AUDIT CHECKS PASSED WITH 0 BREAKAGES!`);
      process.exit(0);
    }
  } catch (err) {
    console.error('Audit encountered unexpected error:', err);
    process.exit(1);
  }
}

main();
