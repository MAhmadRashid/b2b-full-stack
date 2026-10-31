import React from "react";

export type BadgeVariant = "cyan" | "indigo" | "emerald" | "amber" | "danger" | "neutral";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "indigo",
  className = "",
  style,
  ...props
}) => {
  const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
    cyan: {
      background: "var(--info-bg)",
      color: "var(--info)",
      border: "1px solid var(--border-medium)",
    },
    indigo: {
      background: "var(--soft-accent-bg, rgba(99, 102, 241, 0.14))",
      color: "var(--accent-indigo)",
      border: "1px solid var(--border-medium)",
    },
    emerald: {
      background: "var(--success-bg)",
      color: "var(--success)",
      border: "1px solid var(--border-medium)",
    },
    amber: {
      background: "var(--warning-bg)",
      color: "var(--warning)",
      border: "1px solid var(--border-medium)",
    },
    danger: {
      background: "var(--danger-bg)",
      color: "var(--danger)",
      border: "1px solid var(--border-medium)",
    },
    neutral: {
      background: "var(--bg-card-hover, rgba(255, 255, 255, 0.06))",
      color: "var(--text-secondary)",
      border: "1px solid var(--border-subtle)",
    },
  };

  return (
    <span
      className={`badge ${className}`}
      style={{
        ...variantStyles[variant],
        fontSize: "12px",
        fontWeight: 600,
        letterSpacing: "0.03em",
        padding: "4px 12px",
        borderRadius: "9999px",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        ...style,
      }}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
