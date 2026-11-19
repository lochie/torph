import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import React from "react";

import { Code } from "@/surfaces/docs";

const text = (node: React.ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return `${node}`;
  if (Array.isArray(node)) return node.map(text).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node))
    return text(node.props.children);
  return "";
};

const slug = (node: React.ReactNode) =>
  text(node)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const heading = (Tag: "h2" | "h3") => {
  const Heading = ({ children }: { children?: React.ReactNode }) => {
    const id = slug(children);
    return (
      <Tag id={id}>
        <a href={`#${id}`}>{children}</a>
      </Tag>
    );
  };
  Heading.displayName = Tag;
  return Heading;
};

const components: MDXComponents = {
  h2: heading("h2"),
  h3: heading("h3"),
  pre: ({ children }) => <Code code={text(children).replace(/\n$/, "")} />,
  a: ({ href = "", children }) =>
    href.startsWith("/") || href.startsWith("#") ? (
      <Link href={href}>{children}</Link>
    ) : (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}
