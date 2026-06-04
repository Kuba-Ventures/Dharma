import * as React from "react";

// Minimal stand-in for next/image in unit tests: render a plain <img> and drop
// Next-only props so they don't leak onto the DOM node.
export default function Image({
  src,
  alt = "",
  width,
  height,
  // Next-specific props we intentionally discard in tests:
  priority: _priority,
  fill: _fill,
  quality: _quality,
  placeholder: _placeholder,
  blurDataURL: _blurDataURL,
  loader: _loader,
  unoptimized: _unoptimized,
  ...rest
}: any) {
  const resolved = typeof src === "object" && src !== null ? src.src : src;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={resolved} alt={alt} width={width} height={height} {...rest} />;
}
