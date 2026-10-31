import React from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  className = "",
  icon,
  style,
  ...props
}) => {
  const variantClass =
    variant === "primary"
      ? "btn-primary"
      : variant === "secondary"
      ? "btn-secondary"
      : variant === "ghost"
      ? "btn-ghost"
      : "btn-danger";

  const sizeClass = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";

  return (
    <button
      className={`btn ${variantClass} ${sizeClass} ${className}`}
      style={style}
      {...props}
    >
      {children}
      {icon && <span style={{ display: "inline-flex", alignItems: "center" }}>{icon}</span>}
    </button>
  );
};

export default Button;
