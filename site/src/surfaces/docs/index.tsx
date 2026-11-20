"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

import { CodeBlock } from "@/components/codeblock";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { SECTIONS } from "./pages";
import styles from "./styles.module.scss";

export {
  EngineAloneDemo,
  HelloDemo,
  InterruptDemo,
  NumbersDemo,
  PluginOrderDemo,
  RiseDemo,
} from "./examples";

export const Code = ({ code }: { code: string }) => <CodeBlock code={code} />;

export const Docs = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const pages = SECTIONS.flatMap((section) => section.pages);
  const at = pages.findIndex((page) => page.href === pathname);
  const prev = pages[at - 1];
  const next = pages[at + 1];
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Header />
        <div className={styles.layout}>
          <nav className={styles.sidebar} aria-label="Docs">
            {SECTIONS.map((section) => (
              <div key={section.title} className={styles.section}>
                <span className={styles.sectionTitle}>{section.title}</span>
                {section.pages.map((page) => (
                  <Link
                    key={page.href}
                    href={page.href}
                    className={styles.link}
                    aria-current={page.href === pathname ? "page" : undefined}
                  >
                    {page.title}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <article className={styles.prose}>
            {children}
            <div className={styles.pager}>
              {prev ? (
                <Link href={prev.href} className={styles.pagerLink}>
                  <span>Previous</span>
                  {prev.title}
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link
                  href={next.href}
                  className={styles.pagerLink}
                  data-next=""
                >
                  <span>Next</span>
                  {next.title}
                </Link>
              )}
            </div>
          </article>
        </div>
        <Footer />
      </div>
    </div>
  );
};
