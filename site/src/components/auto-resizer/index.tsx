import { useAutoResize } from "@/hooks/useAutoResize";

export const AutoResize = ({
  children,
  overflow = false,
  duration = 400,
  className,
  property = "height",
}: {
  children: React.ReactNode;
  overflow?: boolean;
  duration?: number;
  className?: string;
  property?: "height" | "width" | "both";
}) => {
  const { ref, width, height } = useAutoResize({
    property,
  });
  const transitionProperty = property === "both" ? "height, width" : property;

  return (
    <div
      style={{
        height,
        width,
        overflow: overflow ? "visible" : "hidden",
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: "cubic-bezier(0.19, 1, 0.22, 1)",
        transitionProperty,
      }}
      className={className}
    >
      <div ref={ref}>{children}</div>
    </div>
  );
};
