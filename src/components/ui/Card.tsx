import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  interactive?: boolean;
  className?: string;
  glow?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  interactive = false,
  className = "",
  glow = false,
  style,
  ...props
}) => {
  return (
    <div
      className={`glass-card ${interactive ? "glass-card-interactive" : ""} ${className}`}
      style={{
        boxShadow: glow ? "0 0 30px rgba(99, 102, 241, 0.25)" : undefined,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
