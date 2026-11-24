export type DocPage = { href: string; title: string };

export const SECTIONS: { title: string; pages: DocPage[] }[] = [
  {
    title: "Guide",
    pages: [
      { href: "/docs", title: "Getting started" },
      { href: "/docs/options", title: "Options" },
      { href: "/docs/numbers", title: "Numbers" },
      { href: "/docs/plugins", title: "Using plugins" },
    ],
  },
  {
    title: "Plugin authors",
    pages: [
      { href: "/docs/writing-plugins", title: "Writing a plugin" },
      { href: "/docs/plugin-reference", title: "Plugin reference" },
      { href: "/docs/debugging", title: "Debugging" },
    ],
  },
];
