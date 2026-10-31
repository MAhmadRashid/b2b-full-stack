import { NextResponse } from "next/server";

export async function GET() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
  <defs>
    <linearGradient id="nx-favicon-flow" x1="6" y1="8" x2="42" y2="40" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7C5CFC" />
      <stop offset="45%" stop-color="#6366F1" />
      <stop offset="80%" stop-color="#06B6D4" />
      <stop offset="100%" stop-color="#22D3EE" />
    </linearGradient>
    <linearGradient id="nx-favicon-bridge" x1="42" y1="10" x2="6" y2="38" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#22D3EE" stop-opacity="0.95" />
      <stop offset="50%" stop-color="#818CF8" stop-opacity="0.85" />
      <stop offset="100%" stop-color="#A855F7" stop-opacity="0.95" />
    </linearGradient>
    <radialGradient id="nx-favicon-spark" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="45%" stop-color="#22D3EE" />
      <stop offset="100%" stop-color="#7C5CFC" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="48" height="48" rx="12" fill="#0A0F1E" />
  <circle cx="24" cy="24" r="19" stroke="url(#nx-favicon-flow)" stroke-width="1.2" stroke-dasharray="3 4" opacity="0.25" />
  <path d="M 10 32 C 10 20, 20 12, 28 14 C 36 16, 38 26, 38 32 C 38 38, 30 40, 24 35 C 18 30, 16 16, 26 12 C 33 9, 39 14, 40 20" stroke="url(#nx-favicon-flow)" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M 8 20 C 9 14, 15 10, 22 13 C 28 16, 30 28, 38 28" stroke="url(#nx-favicon-bridge)" stroke-width="2.8" stroke-linecap="round" opacity="0.75" />
  <circle cx="10" cy="32" r="2.8" fill="#7C5CFC" />
  <circle cx="38" cy="32" r="2.8" fill="#22D3EE" />
  <circle cx="24" cy="24" r="4.5" fill="url(#nx-favicon-spark)" opacity="0.9" />
  <circle cx="24" cy="24" r="1.6" fill="#FFFFFF" />
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
