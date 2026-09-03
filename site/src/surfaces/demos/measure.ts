/** Each string's natural width, measured once in the reference element's own type. */
export const measureForms = (reference: HTMLElement, forms: string[]) => {
  const probe = document.createElement("span");
  const style = getComputedStyle(reference);
  Object.assign(probe.style, {
    position: "absolute",
    visibility: "hidden",
    whiteSpace: "pre",
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    letterSpacing: style.letterSpacing,
    fontVariantNumeric: style.fontVariantNumeric,
  });
  reference.parentElement!.appendChild(probe);
  const widths = forms.map((text) => {
    probe.textContent = text;
    return probe.getBoundingClientRect().width;
  });
  probe.remove();
  return widths;
};
