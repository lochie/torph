import type { TorphPlugin } from "../../lib/text-morph/plugin";

export type MagnetOptions = {
  /** How near the pointer has to come to move a letter, in px. */
  radius?: number;
  /** How far a letter right under the pointer moves, as a share of the radius. */
  strength?: number;
};

/** Letters near the pointer lean away from it, and settle back when it leaves. */
export function magnet({
  radius = 60,
  strength = 0.12,
}: MagnetOptions = {}): TorphPlugin {
  return {
    name: "magnet",
    key: `${radius}\u0000${strength}`,
    letters: true,
    // Pushed letters need a box each, at rest too.
    boxes: () => true,
    // `translate`, not `transform`: it composes with the morph's own motion instead of fighting it.
    css: `[torph-magnet] > [torph-id] { transition: translate 300ms cubic-bezier(0.2, 0.8, 0.2, 1); }`,
    mount: (root) => {
      root.setAttribute("torph-magnet", "");
      const pushed = new WeakMap<Element, [number, number]>();
      let pointer: { x: number; y: number } | null = null;
      let frame = 0;

      const apply = () => {
        frame = 0;
        const boxes = Array.from(
          root.querySelectorAll<HTMLElement>(
            ":scope > [torph-id]:not([torph-exiting])",
          ),
        );
        // Every read before any write.
        const rects = boxes.map((box) => box.getBoundingClientRect());
        boxes.forEach((box, i) => {
          const rect = rects[i]!;
          // Where the letter would be unpushed, so moving it doesn't move the target.
          const [px, py] = pushed.get(box) ?? [0, 0];
          const dx = rect.left + rect.width / 2 - px - (pointer?.x ?? 0);
          const dy = rect.top + rect.height / 2 - py - (pointer?.y ?? 0);
          const distance = Math.hypot(dx, dy);
          if (!pointer || !distance || distance > radius) {
            pushed.delete(box);
            box.style.translate = "";
            return;
          }
          const push = (1 - distance / radius) * radius * strength;
          const offset: [number, number] = [
            (dx / distance) * push,
            (dy / distance) * push,
          ];
          pushed.set(box, offset);
          box.style.translate = `${offset[0]}px ${offset[1]}px`;
        });
      };
      const schedule = () => {
        frame ||= requestAnimationFrame(apply);
      };
      const move = (event: PointerEvent) => {
        pointer = { x: event.clientX, y: event.clientY };
        schedule();
      };
      const leave = () => {
        pointer = null;
        schedule();
      };

      root.addEventListener("pointermove", move);
      root.addEventListener("pointerleave", leave);
      return () => {
        cancelAnimationFrame(frame);
        root.removeEventListener("pointermove", move);
        root.removeEventListener("pointerleave", leave);
        root.removeAttribute("torph-magnet");
        for (const box of Array.from(
          root.querySelectorAll<HTMLElement>("[torph-id]"),
        )) {
          box.style.translate = "";
        }
      };
    },
  };
}
