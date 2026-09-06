// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { TextMorph } from "../index";
import type { TextMorphOptions } from "../types";
import { segmentContent } from "../utils/segment";
import { diffSegments } from "../utils/diff";
import {
  ATTR_FORMAT,
  ATTR_INTERACTIVE,
  ATTR_KEY,
  flattenContent,
} from "../utils/content";
import { pairElementSlots } from "../../utils/flip";
import {
  ATTR_EXITING,
  ATTR_GROUP,
  ATTR_ID,
  ATTR_ITEM,
  ATTR_NODE,
  ATTR_SR,
} from "../../utils/constants";

// An element child is a segment like any other — it just never splits. What is
// under test is that identity survives a morph (the same DOM node stays in the
// same item), that the text around one still morphs against it, and that a
// dropped element leaves through the exit path rather than being cut.

beforeAll(() => {
  const original = Element.prototype.animate;
  Element.prototype.animate = function (
    this: Element,
    keyframes: unknown,
    options: unknown,
  ) {
    const animation = original.call(this, keyframes as never, options as never);
    animation.finished?.catch(() => {});
    return animation;
  } as typeof Element.prototype.animate;
});

const mounted: TextMorph[] = [];

function mount(options: Partial<TextMorphOptions> = {}) {
  const element = document.createElement("span");
  document.body.appendChild(element);
  const morph = new TextMorph({
    element,
    respectReducedMotion: false,
    ...options,
  });
  mounted.push(morph);
  return { element, morph };
}

afterEach(() => {
  while (mounted.length) mounted.pop()!.destroy();
  document.body.innerHTML = "";
});

/** A source container of the shape a framework wrapper hands in. */
function source(...parts: (string | { key: string; tag?: string })[]) {
  const holder = document.createElement("span");
  for (const part of parts) {
    if (typeof part === "string") {
      holder.append(part);
      continue;
    }
    const node = document.createElement(part.tag ?? "img");
    node.setAttribute(ATTR_KEY, part.key);
    holder.append(node);
  }
  return holder;
}

// Descendants, not children: a formatted run holds its items in a real wrapper.
const items = (element: HTMLElement) =>
  Array.from(element.querySelectorAll<HTMLElement>(`[${ATTR_ITEM}]`));

const live = (element: HTMLElement) =>
  items(element).filter((child) => !child.hasAttribute(ATTR_EXITING));

const rendered = (element: HTMLElement) =>
  live(element)
    .map((child) =>
      child.firstElementChild
        ? `<${child.firstElementChild.tagName.toLowerCase()}>`
        : (child.textContent ?? "").replace(/\u00A0/g, " "),
    )
    .join("");

const itemFor = (element: HTMLElement, id: string) =>
  items(element).find((child) => child.getAttribute(ATTR_ID) === id);

type Frame = { transform?: string; offset?: number };

/** Every transform an item was given, flattened to one comparable string. */
function recordTransforms() {
  const calls: { id: string | null; frames: Frame[] }[] = [];
  const original = Element.prototype.animate;

  Element.prototype.animate = function (
    this: Element,
    keyframes: unknown,
    options: unknown,
  ) {
    const frames = (
      Array.isArray(keyframes) ? keyframes : [keyframes]
    ) as Frame[];
    if (frames.some((frame) => frame.transform !== undefined)) {
      calls.push({
        id: this.closest(`[${ATTR_ID}]`)?.getAttribute(ATTR_ID) ?? null,
        frames,
      });
    }
    return original.call(this, keyframes as never, options as never);
  } as typeof Element.prototype.animate;

  return {
    restore: () => (Element.prototype.animate = original),
    transformsFor: (id: string) =>
      calls
        .filter((call) => call.id === id)
        .flatMap((call) =>
          call.frames.map((frame) => `${frame.transform} @${frame.offset}`),
        ),
  };
}

describe("elements reach the DOM", () => {
  it("places an element in an item of its own", () => {
    const { element, morph } = mount();
    morph.update(source("Connect ", { key: "avatar" }, " wallet"));

    expect(rendered(element)).toBe("Connect <img> wallet");
    const item = live(element).find((child) => child.firstElementChild);
    expect(item!.hasAttribute(ATTR_ITEM)).toBe(true);
    expect(item!.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps the same node in the same item across a morph", () => {
    const { element, morph } = mount();
    const avatar = document.createElement("img");
    avatar.setAttribute(ATTR_KEY, "avatar");

    const first = document.createElement("span");
    first.append(avatar, " lochie.eth");
    morph.update(first);

    const id = items(element).find((child) => child.firstElementChild)!;
    const before = { item: id, node: id.firstElementChild };

    const second = document.createElement("span");
    second.append(avatar, " lochie.dev");
    morph.update(second);

    const after = items(element).find((child) => child.firstElementChild)!;
    expect(after).toBe(before.item);
    expect(after.firstElementChild).toBe(before.node);
    expect(after.firstElementChild).toBe(avatar);
  });

  it("adopts a replacement node under the same key", () => {
    const { element, morph } = mount();
    morph.update(source({ key: "icon", tag: "svg" }, " Processing"));
    const item = items(element).find((child) => child.firstElementChild)!;

    morph.update(source({ key: "icon", tag: "b" }, " Processed"));

    expect(item.firstElementChild!.tagName.toLowerCase()).toBe("b");
    expect(item.childNodes.length).toBe(1);
  });

  it("exits an element that the next value drops", () => {
    const { element, morph } = mount();
    morph.update(source({ key: "avatar" }, " lochie.eth"));
    morph.update(source("Connect wallet"));

    const exiting = items(element).filter((child) =>
      child.hasAttribute(ATTR_EXITING),
    );
    expect(exiting.some((child) => child.firstElementChild)).toBe(true);
    expect(rendered(element)).toBe("Connect wallet");
  });

  it("enters an element the previous value had no room for", () => {
    const { element, morph } = mount();
    morph.update(source("Connecting…"));
    morph.update(source({ key: "avatar" }, " lochie.eth"));

    expect(rendered(element)).toBe("<img> lochie.eth");
  });

  it("morphs the text around a persisting element", () => {
    const { element, morph } = mount();
    morph.update(source({ key: "icon" }, " Processing Transaction"));
    const before = itemFor(element, "Transaction");

    morph.update(source({ key: "icon" }, " Transaction Safe"));

    expect(itemFor(element, "Transaction")).toBe(before);
    expect(rendered(element)).toBe("<img> Transaction Safe");
  });

  it("reads as the value, with the element's label in place", () => {
    const { element, morph } = mount();
    const holder = document.createElement("span");
    const avatar = document.createElement("img");
    avatar.setAttribute(ATTR_KEY, "avatar");
    avatar.setAttribute("alt", "Lochie");
    holder.append(avatar, " signed in");
    morph.update(holder);

    const sr = Array.from(element.children).find((child) =>
      child.hasAttribute(ATTR_SR),
    );
    expect(sr!.textContent).toBe("Lochie signed in");
  });

  it("swaps one element for another where it stands, not after the words", () => {
    const { morph } = mount();
    morph.update(source({ key: "spin" }, " Processing Transaction"));

    const recorder = recordTransforms();
    morph.update(source({ key: "check" }, " Transaction Safe"));
    recorder.restore();

    // The swap gesture, and each anchored on the other rather than on a word:
    // happy-dom has no layout, so a delta off any other segment would still be 0,
    // but `pairElements` is what decides these two are one slot.
    expect(recorder.transformsFor("\u0000espin")).toEqual([
      "translate(0px, 0px) scale(0.6) @1",
    ]);
    expect(recorder.transformsFor("\u0000echeck")).toEqual([
      "translate(0px, 0px) scale(0.6) @undefined",
      "none @undefined",
    ]);
  });

  it("marks an element item, so an exit still knows what it is", () => {
    const { element, morph } = mount();
    morph.update(source({ key: "icon" }, " Processing"));

    const item = items(element).find((child) => child.firstElementChild)!;
    expect(item.hasAttribute(ATTR_NODE)).toBe(true);

    morph.update(source("Processing"));
    const leaving = items(element).find((child) =>
      child.hasAttribute(ATTR_EXITING),
    );
    expect(leaving!.hasAttribute(ATTR_NODE)).toBe(true);
  });

  it("leaves a decorative element out of the value read aloud", () => {
    const { element, morph } = mount();
    const holder = document.createElement("span");
    const badge = document.createElement("span");
    badge.setAttribute(ATTR_KEY, "badge");
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = "A";
    holder.append(badge, " Ana is editing");
    morph.update(holder);

    const sr = Array.from(element.children).find((child) =>
      child.hasAttribute(ATTR_SR),
    );
    expect(sr!.textContent).toBe(" Ana is editing");
  });

  it("places elements without splitting anything when disabled", () => {
    const { element, morph } = mount({ disabled: true });
    morph.update(source("Hello ", { key: "avatar" }));

    expect(element.querySelector(`[${ATTR_ITEM}]`)).toBe(null);
    expect(element.querySelector("img")).not.toBe(null);
    expect(element.textContent).toBe("Hello ");
  });
});

describe("an element that speaks for itself", () => {
  function withButton(label: string, tail: string) {
    const holder = document.createElement("span");
    const button = document.createElement("button");
    button.setAttribute(ATTR_KEY, "chip");
    button.setAttribute(ATTR_INTERACTIVE, "");
    button.textContent = label;
    holder.append(button, tail);
    return holder;
  }

  it("leaves it in the accessibility tree", () => {
    const { element, morph } = mount();
    morph.update(withButton("Remove Design", " and 2 more"));

    const item = items(element).find((child) => child.querySelector("button"))!;
    expect(item.hasAttribute("aria-hidden")).toBe(false);
  });

  it("keeps its label out of the plain-text copy, which would say it twice", () => {
    const { element, morph } = mount();
    morph.update(withButton("Remove Design", " and 2 more"));

    const sr = Array.from(element.children).find((child) =>
      child.hasAttribute(ATTR_SR),
    );
    expect(sr!.textContent).toBe(" and 2 more");
  });

  it("puts it beyond reach on the way out", () => {
    const { element, morph } = mount();
    morph.update(withButton("Remove Design", " and 2 more"));
    morph.update("nothing left");

    const leaving = items(element).find((child) =>
      child.hasAttribute(ATTR_EXITING),
    )!;
    expect(leaving.getAttribute("aria-hidden")).toBe("true");
    expect(leaving.hasAttribute("inert")).toBe(true);
  });

  it("hides an element that says nothing about itself", () => {
    const { element, morph } = mount();
    morph.update(source({ key: "icon" }, " Processing"));

    const item = items(element).find((child) => child.firstElementChild)!;
    expect(item.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("a run that speaks for itself", () => {
  function linked(lead: string, label: string, href: string) {
    const holder = document.createElement("span");
    const anchor = document.createElement("a");
    anchor.setAttribute(ATTR_FORMAT, "");
    anchor.setAttribute(ATTR_INTERACTIVE, "");
    anchor.setAttribute("href", href);
    anchor.textContent = label;
    holder.append(lead, anchor);
    return holder;
  }

  it("keeps the tag real, attributes and all", () => {
    const { element, morph } = mount();
    morph.update(linked("Read the ", "release notes", "/notes"));

    const group = element.querySelector(`[${ATTR_GROUP}]`)!;
    expect(group.tagName).toBe("A");
    expect(group.getAttribute("href")).toBe("/notes");
  });

  it("names the whole run, not each word in it", () => {
    const { element, morph } = mount();
    morph.update(linked("Read the ", "release notes", "/notes"));

    const group = element.querySelector(`[${ATTR_GROUP}]`)!;
    expect(group.getAttribute("aria-label")).toBe("release notes");
    expect(group.querySelectorAll(`[${ATTR_ITEM}]`).length).toBeGreaterThan(1);
  });

  it("leaves its words out of the plain-text copy", () => {
    const { element, morph } = mount();
    morph.update(linked("Read the ", "release notes", "/notes"));

    const sr = Array.from(element.children).find((child) =>
      child.hasAttribute(ATTR_SR),
    );
    expect(sr!.textContent).toBe("Read the ");
  });

  it("re-labels a run whose words changed", () => {
    const { element, morph } = mount();
    morph.update(linked("Read the ", "release notes", "/notes"));
    morph.update(linked("Read the ", "changelog", "/notes"));

    const group = element.querySelector(`[${ATTR_GROUP}]`)!;
    expect(group.getAttribute("aria-label")).toBe("changelog");
  });
});

describe("which elements count as one slot", () => {
  const pair = (
    oldIds: string[],
    newIds: string[],
    leaving: string[],
    arriving: string[],
  ) =>
    pairElementSlots(
      oldIds,
      newIds,
      (id) => leaving.includes(id),
      (id) => arriving.includes(id),
    );

  it("pairs one traded for another in the same place", () => {
    const partners = pair(["spin"], ["check"], ["spin"], ["check"]);

    expect(partners.get("spin")).toBe("check");
    expect(partners.get("check")).toBe("spin");
  });

  it("leaves the head and the tail of a set unpaired", () => {
    // a b c -> b c d: nothing was traded, the set moved along.
    const partners = pair(["a", "b", "c"], ["b", "c", "d"], ["a"], ["d"]);

    expect(partners.size).toBe(0);
  });

  it("pairs only the positions that actually changed hands", () => {
    const partners = pair(
      ["s0", "s1", "s2", "s3", "s4"],
      ["s0", "s1", "s2", "n3", "n4"],
      ["s3", "s4"],
      ["n3", "n4"],
    );

    expect(partners.get("s3")).toBe("n3");
    expect(partners.get("s4")).toBe("n4");
    expect(partners.has("s0")).toBe(false);
  });
});

describe("formatting", () => {
  /** A source where `<strong>` wraps one of the words. */
  function emphasised(before: string, bold: string, after: string) {
    const holder = document.createElement("span");
    if (before) holder.append(before);
    const strong = document.createElement("strong");
    strong.textContent = bold;
    holder.append(strong);
    if (after) holder.append(after);
    return holder;
  }

  it("clears the markup a server rendered before it takes over", () => {
    const { element, morph } = mount();
    // What the React wrapper paints for the first frame, newlines and all.
    element.innerHTML = "Ana replied<br>to your comment";

    morph.update(emphasised("Ana ", "replied", "\nto your comment"));

    expect(element.querySelectorAll("br")).toHaveLength(1);
    expect(element.querySelector("br")!.hasAttribute(ATTR_ITEM)).toBe(true);
    expect(items(element)[0]!.getAttribute(ATTR_ID)).toBe("Ana");
  });

  it("puts the word inside a real tag", () => {
    const { element, morph } = mount();
    morph.update(emphasised("", "Ana", " replied"));

    const item = itemFor(element, "Ana")!;
    expect(item.parentElement!.tagName).toBe("STRONG");
    expect(item.parentElement!.hasAttribute(ATTR_GROUP)).toBe(true);
    expect(item.textContent).toBe("Ana");
  });

  it("keeps the word, and takes the tag off it", () => {
    const { element, morph } = mount();
    morph.update(emphasised("", "Ana", " replied to your comment"));
    const before = itemFor(element, "Ana");

    morph.update(emphasised("Ana replied to ", "your comment", ""));

    const after = itemFor(element, "Ana")!;
    expect(after).toBe(before);
    expect(after.parentElement).toBe(element);
    expect(after.textContent).toBe("Ana");
  });

  it("puts the tag on a word that had none", () => {
    const { element, morph } = mount();
    morph.update(emphasised("Ana replied to ", "your", " comment"));

    morph.update(emphasised("", "Ana", " replied to your comment"));

    expect(itemFor(element, "your")!.parentElement).toBe(element);
    expect(itemFor(element, "Ana")!.parentElement!.tagName).toBe("STRONG");
  });

  it("reads as the words alone", () => {
    const { element, morph } = mount();
    morph.update(emphasised("", "Ana", " replied"));

    const sr = Array.from(element.children).find((child) =>
      child.hasAttribute(ATTR_SR),
    );
    expect(sr!.textContent).toBe("Ana replied");
  });

  it("keeps an element atomic when it carries a key", () => {
    const { element, morph } = mount();
    const holder = document.createElement("span");
    const badge = document.createElement("strong");
    badge.setAttribute(ATTR_KEY, "badge");
    badge.textContent = "New";
    holder.append(badge, " release");
    morph.update(holder);

    const item = items(element).find((child) => child.firstElementChild)!;
    expect(item.hasAttribute(ATTR_NODE)).toBe(true);
    expect(item.firstElementChild).toBe(badge);
  });

  it("keeps an element with no text in it, rather than flattening it away", () => {
    const { element, morph } = mount();
    const holder = document.createElement("span");
    const swatch = document.createElement("span");
    swatch.setAttribute("style", "background:red");
    holder.append(swatch, "Red");
    morph.update(holder);

    const item = items(element).find((child) => child.firstElementChild)!;
    expect(item.hasAttribute(ATTR_NODE)).toBe(true);
    expect(item.firstElementChild).toBe(swatch);
  });

  it("treats a bare span as a thing, not as emphasis", () => {
    const { element, morph } = mount();
    const holder = document.createElement("span");
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = "beta";
    holder.append(chip, " build");
    morph.update(holder);

    const item = items(element).find((child) => child.firstElementChild)!;
    expect(item.hasAttribute(ATTR_NODE)).toBe(true);
    expect(item.firstElementChild).toBe(chip);
  });

  it("puts a whole run in one wrapper, spaces included", () => {
    const { element, morph } = mount();
    const holder = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = "real blocks";
    holder.append("into ", strong, " now");
    morph.update(holder);

    const groups = element.querySelectorAll(`[${ATTR_GROUP}]`);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.tagName).toBe("STRONG");
    // "real", the space between it and "blocks", and "blocks".
    expect(groups[0]!.querySelectorAll(`[${ATTR_ITEM}]`)).toHaveLength(3);
    expect(groups[0]!.textContent).toBe("real\u00A0blocks");
  });

  it("moves an item out of the run it stops belonging to", () => {
    const { element, morph } = mount();
    morph.update(emphasised("into ", "blocks", " now"));
    const item = itemFor(element, "blocks")!;
    expect(item.parentElement!.hasAttribute(ATTR_GROUP)).toBe(true);

    morph.update(emphasised("into blocks ", "now", ""));

    expect(itemFor(element, "blocks")).toBe(item);
    expect(item.parentElement).toBe(element);
  });

  it("leaves no empty wrapper behind when a run goes away", () => {
    const { element, morph } = mount();
    morph.update(emphasised("into ", "blocks", " now"));
    morph.update(emphasised("into blocks now", "", ""));

    expect(element.querySelectorAll(`[${ATTR_GROUP}]`)).toHaveLength(0);
  });

  it("nests the tags it was given, outermost first", () => {
    const { element, morph } = mount();
    const holder = document.createElement("span");
    const strong = document.createElement("strong");
    const em = document.createElement("em");
    em.textContent = "now";
    strong.appendChild(em);
    holder.append("Ship ", strong);
    morph.update(holder);

    const item = itemFor(element, "now")!;
    expect(item.parentElement!.tagName).toBe("EM");
    expect(item.parentElement!.parentElement!.tagName).toBe("STRONG");
    expect(item.textContent).toBe("now");
  });
});

describe("element segments", () => {
  it("gives an element an ID no text segment can collide with", () => {
    const segments = segmentContent(
      flattenContent(source("a ", { key: "a" })),
      "en",
    );
    const ids = segments.map((segment) => segment.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.some((id) => id.startsWith("\u0000e"))).toBe(true);
  });

  it("keeps IDs unique when two elements share a key", () => {
    const holder = source({ key: "dup" }, " ", { key: "dup" });
    const segments = segmentContent(flattenContent(holder), "en");
    const ids = segments.map((segment) => segment.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never pairs an element with a word", () => {
    const from = segmentContent(flattenContent(source("Processing")), "en");
    const { segments } = diffSegments(
      from,
      flattenContent(source({ key: "icon" })),
      "en",
    );

    expect(segments).toHaveLength(1);
    expect(segments[0]!.node).toBeDefined();
  });

  it("carries the element through a diff that rewrites every word", () => {
    const from = segmentContent(
      flattenContent(source({ key: "icon" }, " Processing Transaction")),
      "en",
    );
    const { segments } = diffSegments(
      from,
      flattenContent(source({ key: "icon" }, " Transaction Safe")),
      "en",
    );

    const element = segments.filter((segment) => segment.node);
    expect(element).toHaveLength(1);
    expect(element[0]!.id).toBe(from[0]!.id);
  });
});
