import { useEffect, useState } from "react";
type MouseProps = {
  x: number;
  y: number;
  xv: number;
  yv: number;
  isDown: boolean;
  horizontal: "left" | "right";
  vertical: "top" | "bottom";
};

export const useMouse = () => {
  const [mouse, setMouse] = useState<MouseProps>({
    x: 0,
    y: 0,
    xv: 0,
    yv: 0,
    isDown: false,
    horizontal: "left",
    vertical: "top",
  });

  const onUpdate = (e: MouseEvent) => {
    setMouse((prev) => ({
      x: e.clientX,
      y: e.clientY,
      xv: e.movementX,
      yv: e.movementY,
      isDown: e.buttons === 1,
      horizontal:
        e.movementX > 0 ? "right" : e.movementX < 0 ? "left" : prev.horizontal,
      vertical:
        e.movementY > 0 ? "bottom" : e.movementY < 0 ? "top" : prev.vertical,
    }));
  };
  const onTouchUpdate = (e: TouchEvent) => {
    if (e.touches.length === 0) return;
    setMouse((prev) => ({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      xv: e.touches[0].clientX - prev.x,
      yv: e.touches[0].clientY - prev.y,
      isDown: e.touches.length > 0,
      horizontal:
        e.touches[0].clientX - prev.x > 0
          ? "right"
          : e.touches[0].clientX - prev.x < 0
            ? "left"
            : prev.horizontal,
      vertical:
        e.touches[0].clientY - prev.y > 0
          ? "bottom"
          : e.touches[0].clientY - prev.y < 0
            ? "top"
            : prev.vertical,
    }));
  };

  useEffect(() => {
    window.addEventListener("mousemove", onUpdate);
    window.addEventListener("mousedown", onUpdate);
    window.addEventListener("mouseup", onUpdate);

    window.addEventListener("touchmove", onTouchUpdate);
    window.addEventListener("touchstart", onTouchUpdate);
    window.addEventListener("touchend", onTouchUpdate);
    return () => {
      window.removeEventListener("mousemove", onUpdate);
      window.removeEventListener("mousedown", onUpdate);
      window.removeEventListener("mouseup", onUpdate);

      window.removeEventListener("touchmove", onTouchUpdate);
      window.removeEventListener("touchstart", onTouchUpdate);
      window.removeEventListener("touchend", onTouchUpdate);
    };
  }, []);

  return {
    mouse,
  };
};
