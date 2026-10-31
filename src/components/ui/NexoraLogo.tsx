import React from "react";
import Link from "next/link";

export interface LogoProps {
  /**
   * Size preset or custom pixel number:
   * - "xs": 20px icon, 14px text
   * - "sm": 26px icon, 16px text
   * - "md": 32px icon, 19px text (default)
   * - "lg": 40px icon, 22px text
   * - "xl": 52px icon, 28px text
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  /**
   * Display variant:
   * - "full": Icon + Wordmark "Nexora"
   * - "icon-only": Just the vector abstract flow/connectivity icon
   * - "wordmark-only": Just the text "Nexora" with gradient accent
   */
  variant?: "full" | "icon-only" | "wordmark-only";
  /**
   * Optional href to wrap in a Link. Defaults to undefined (renders container div).
   */
  href?: string;
  /**
   * Custom additional class names.
   */
  className?: string;
  /**
   * Inline style overrides.
   */
  style?: React.CSSProperties;
  /**
   * Whether to display glowing ambient backdrop under icon.
   */
  withGlow?: boolean;
  /**
   * Dark or light theme adjustment for text contrast. Default is "dark" (light text).
   */
  theme?: "dark" | "light" | "auto";
  /**
   * Optional spinning / pulsing animation state (e.g. for loading screens).
   */
  animated?: boolean;
  /**
   * Accessible ARIA label.
   */
  ariaLabel?: string;
}

const SIZE_MAP = {
  xs: { iconSize: 20, fontSize: "14px", radius: 6, gap: "6px" },
  sm: { iconSize: 26, fontSize: "16px", radius: 8, gap: "8px" },
  md: { iconSize: 34, fontSize: "19px", radius: 10, gap: "10px" },
  lg: { iconSize: 42, fontSize: "22px", radius: 12, gap: "12px" },
  xl: { iconSize: 54, fontSize: "28px", radius: 14, gap: "14px" },
};

/**
 * Pure SVG Abstract Nexora Flow & Connectivity Vector Icon Component
 * Visual motifs: Infinity helix flow, dual connectivity nodes, Royal Purple & Cyan hyper-gradients
 */
export function NexoraIcon({
  size = 34,
  className = "",
  style = {},
  withGlow = false,
  animated = false,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  withGlow?: boolean;
  animated?: boolean;
}) {
  const uniqueId = React.useId().replace(/:/g, "");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${animated ? "animate-pulse" : ""} ${className}`}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        filter: withGlow ? "drop-shadow(0 0 10px rgba(124, 92, 252, 0.6))" : undefined,
        ...style,
      }}
      aria-hidden="true"
    >
      <defs>
        {/* Core Royal Purple to Vibrant Cyan Flow Gradient */}
        <linearGradient
          id={`nx-grad-flow-${uniqueId}`}
          x1="6"
          y1="8"
          x2="42"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#7C5CFC" />
          <stop offset="45%" stopColor="#6366F1" />
          <stop offset="80%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>

        {/* Counter Interlocking Connectivity Wave */}
        <linearGradient
          id={`nx-grad-interlock-${uniqueId}`}
          x1="42"
          y1="10"
          x2="6"
          y2="38"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#818CF8" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#A855F7" stopOpacity="0.95" />
        </linearGradient>

        {/* Core Spark Radial Center */}
        <radialGradient id={`nx-spark-${uniqueId}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="45%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#7C5CFC" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Background Soft Glow Aura Ring */}
      <circle
        cx="24"
        cy="24"
        r="19"
        stroke="url(#nx-grad-flow-)"
        strokeWidth="1.2"
        strokeDasharray="3 4"
        opacity="0.25"
      />

      {/* Ribbon Loop A: Ascending Energy Flow */}
      <path
        d="M 10 32 C 10 20, 20 12, 28 14 C 36 16, 38 26, 38 32 C 38 38, 30 40, 24 35 C 18 30, 16 16, 26 12 C 33 9, 39 14, 40 20"
        stroke={`url(#nx-grad-flow-${uniqueId})`}
        strokeWidth="3.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Ribbon Loop B: Connectivity Bridge */}
      <path
        d="M 8 20 C 9 14, 15 10, 22 13 C 28 16, 30 28, 38 28"
        stroke={`url(#nx-grad-interlock-${uniqueId})`}
        strokeWidth="2.8"
        strokeLinecap="round"
        opacity="0.75"
      />

      {/* Telemetry Nexus Nodes */}
      <circle cx="10" cy="32" r="2.8" fill="#7C5CFC" />
      <circle cx="38" cy="32" r="2.8" fill="#22D3EE" />
      <circle cx="24" cy="24" r="4.5" fill={`url(#nx-spark-${uniqueId})`} opacity="0.9" />
      <circle cx="24" cy="24" r="1.6" fill="#FFFFFF" />
    </svg>
  );
}

/**
 * Shared Nexora Brand Component with Size, Variant, and Theme Controls
 */
export function NexoraLogo({
  size = "md",
  variant = "full",
  href,
  className = "",
  style = {},
  withGlow = true,
  theme = "dark",
  animated = false,
  ariaLabel = "Nexora Home",
}: LogoProps) {
  const metrics =
    typeof size === "number"
      ? {
          iconSize: size,
          fontSize: `${Math.round(size * 0.58)}px`,
          radius: Math.round(size * 0.26),
          gap: `${Math.round(size * 0.28)}px`,
        }
      : SIZE_MAP[size] || SIZE_MAP.md;

  const textColor = theme === "light" ? "#111827" : "#F8FAFC";

  const content = (
    <div
      className={`nexora-brand-container ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: metrics.gap,
        textDecoration: "none",
        userSelect: "none",
        ...style,
      }}
      aria-label={ariaLabel}
    >
      {/* Vector Icon Container with Royal Dark Glass Surface */}
      {variant !== "wordmark-only" && (
        <div
          style={{
            width: `${metrics.iconSize}px`,
            height: `${metrics.iconSize}px`,
            borderRadius: `${metrics.radius}px`,
            background:
              theme === "light"
                ? "linear-gradient(135deg, #FFFFFF 0%, #EEF2FF 100%)"
                : "linear-gradient(135deg, rgba(23, 30, 50, 0.95), rgba(10, 15, 30, 0.98))",
            border:
              theme === "light"
                ? "1px solid rgba(79, 70, 229, 0.2)"
                : "1px solid rgba(124, 92, 252, 0.35)",
            boxShadow: withGlow
              ? theme === "light"
                ? "0 2px 10px rgba(79, 70, 229, 0.15)"
                : "0 0 18px rgba(124, 92, 252, 0.4)"
              : "none",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            padding: `${Math.max(2, Math.round(metrics.iconSize * 0.1))}px`,
            boxSizing: "border-box",
            transition: "all 0.2s ease",
          }}
        >
          <NexoraIcon
            size={Math.round(metrics.iconSize * 0.82)}
            withGlow={false}
            animated={animated}
          />
        </div>
      )}

      {/* Wordmark */}
      {variant !== "icon-only" && (
        <span
          style={{
            fontSize: metrics.fontSize,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: textColor,
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          Nex
          <span
            style={{
              background:
                theme === "light"
                  ? "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #2563EB 100%)"
                  : "linear-gradient(135deg, #7C5CFC 0%, #A855F7 45%, #22D3EE 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            ora
          </span>
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", display: "inline-flex" }}>
        {content}
      </Link>
    );
  }

  return content;
}

// Backward-compatible exports to safeguard any external or legacy references
export const PulseFlowLogo = NexoraLogo;
export const PulseFlowIcon = NexoraIcon;

export default NexoraLogo;
