// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { TextMorph } from "../index";
import { animateEnterOrPersist } from "../utils/animate";
import { ATTR_EXITING, ATTR_ID, ATTR_SR } from "../../utils/constants";

const mounted: TextMorph[] = [];
afterEach(() => {
  mounted.forEach((morph) => morph.destroy());
  mounted.length = 0;
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("engine work budgets", () => {
  it("replaces an element whose ID now belongs to a different tag", () => {
    const element = document.createElement("span");
    document.body.append(element);
    const morph = new TextMorph({
      element,
      respectReducedMotion: false,
      numbers: false,
    });
    mounted.push(morph);
    morph.update("newline-1");
    morph.update("a\nb");
    const live = Array.from(element.children).filter(
      (child) =>
        !child.hasAttribute(ATTR_SR) && !child.hasAttribute(ATTR_EXITING),
    );
    expect(
      live
        .map((child) => (child.tagName === "BR" ? "\n" : child.textContent))
        .join(""),
    ).toBe("a\nb");
    expect(
      live.filter((child) => child.getAttribute(ATTR_ID) === "newline-1"),
    ).toHaveLength(1);
  });

  it("renders the initial value without reading layout or creating animations", () => {
    const element = document.createElement("span");
    element.textContent = "server placeholder";
    document.body.append(element);
    const morph = new TextMorph({ element, respectReducedMotion: false });
    mounted.push(morph);
    const rect = vi.spyOn(Element.prototype, "getBoundingClientRect");
    const style = vi.spyOn(globalThis, "getComputedStyle");
    const animate = vi.spyOn(Element.prototype, "animate");
    morph.update("Total\n$1,234");
    expect(element.querySelector(`[${ATTR_SR}]`)?.textContent).toBe(
      "Total\n$1,234",
    );
    expect(element.querySelectorAll("br")).toHaveLength(1);
    expect(element.textContent).not.toContain("server placeholder");
    expect(rect).not.toHaveBeenCalled();
    expect(style).not.toHaveBeenCalled();
    expect(animate).not.toHaveBeenCalled();
  });

  it("does not animate stationary, fully opaque text", () => {
    const element = document.createElement("span");
    document.body.append(element);
    const animate = vi.spyOn(element, "animate");
    animateEnterOrPersist(element, {
      deltaX: 0,
      deltaY: 0,
      isNew: false,
      duration: 180,
      ease: "linear",
    });
    expect(animate).not.toHaveBeenCalled();
  });

  it("keeps unchanged text nodes attached when another part of the value changes", () => {
    const element = document.createElement("span");
    document.body.append(element);
    const morph = new TextMorph({ element, respectReducedMotion: false });
    mounted.push(morph);
    morph.update("You have 10 unread messages");
    const word = Array.from(element.children).find(
      (child) => child.textContent === "unread",
    )!;
    const textNode = word.firstChild;
    const observer = new MutationObserver(() => {});
    observer.observe(element, { childList: true, subtree: true });
    morph.update("You have 11 unread messages");
    const records = observer.takeRecords();
    observer.disconnect();
    expect(word.firstChild).toBe(textNode);
    expect(word.parentElement).toBe(element);
    expect(word.hasAttribute(ATTR_EXITING)).toBe(false);
    expect(word.getAttribute(ATTR_ID)).toBe("unread");
    expect(
      records.some((record) => Array.from(record.removedNodes).includes(word)),
    ).toBe(false);
  });
});
