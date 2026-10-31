import React from "react";

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  id?: string;
  className?: string;
  containerClassName?: string;
  children: React.ReactNode;
  paddingY?: boolean;
}

export const Section: React.FC<SectionProps> = ({
  id,
  className = "",
  containerClassName = "",
  children,
  paddingY = true,
  style,
  ...props
}) => {
  return (
    <section
      id={id}
      className={`${paddingY ? "section-py" : ""} ${className}`}
      style={{ position: "relative", zIndex: 10, ...style }}
      {...props}
    >
      <div className={`container-1200 ${containerClassName}`}>{children}</div>
    </section>
  );
};

export default Section;
