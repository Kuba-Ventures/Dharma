import * as React from "react";

// Minimal stand-in for next/link in unit tests: render a plain <a>.
export default function Link({
  href,
  children,
  // Next-specific props we intentionally discard in tests:
  prefetch: _prefetch,
  replace: _replace,
  scroll: _scroll,
  shallow: _shallow,
  passHref: _passHref,
  ...rest
}: any) {
  const resolved = typeof href === "object" && href !== null ? (href.pathname ?? "") : href;
  return (
    <a href={resolved} {...rest}>
      {children}
    </a>
  );
}
