const GETTERS = [
  "offsetWidth",
  "offsetHeight",
  "offsetTop",
  "offsetLeft",
  "clientWidth",
  "clientHeight",
] as const;

const warned = new Set<string>();

/** Runs `fn`, warning once per `label` if it reads layout. Only reached with `debug` on. */
export function guarded<T>(label: string, fn: () => T): T {
  const restores: (() => void)[] = [];
  // What forces a style or layout pass once a hook has started writing.
  const methods: [object, string][] = [
    [Element.prototype, "getBoundingClientRect"],
    [Element.prototype, "getClientRects"],
    [globalThis, "getComputedStyle"],
  ];
  const warn = (what: string) => {
    if (warned.has(label)) return;
    warned.add(label);
    // eslint-disable-next-line no-console
    console.warn(
      `torph: ${label} read ${what}; hooks only write, reads go in \`read\``,
    );
  };

  for (const [owner, name] of methods) {
    const target = owner as Record<string, (...args: unknown[]) => unknown>;
    const original = target[name];
    if (typeof original !== "function") continue;
    target[name] = function (this: unknown, ...args: unknown[]) {
      warn(`${name}()`);
      return original.apply(this, args);
    };
    restores.push(() => (target[name] = original));
  }

  for (const name of GETTERS) {
    const proto = name.startsWith("client")
      ? Element.prototype
      : HTMLElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, name);
    if (!descriptor?.get) continue;
    const get = descriptor.get;
    Object.defineProperty(proto, name, {
      ...descriptor,
      get(this: HTMLElement) {
        warn(name);
        return get.call(this);
      },
    });
    restores.push(() => Object.defineProperty(proto, name, descriptor));
  }

  try {
    return fn();
  } finally {
    for (const restore of restores) restore();
  }
}
