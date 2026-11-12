import type { CSSProperties, ElementType, ReactNode } from 'react';
import { UNIQUE_WEIGHTS } from '../src/typography';

type Props = {
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
  children: ReactNode;
  weight?: keyof typeof UNIQUE_WEIGHTS;
  size?: string;
  className?: string;
  style?: CSSProperties;
};

/** Assumes /fonts/unique.css and /src/tokens.css are loaded in your app. */
export function UniqueHeading({ as = 'h2', children, weight = 'bold', size = 'clamp(2rem, 6vw, 6rem)', className, style }: Props) {
  const Tag = as as ElementType;
  return (
    <Tag className={className} style={{
      fontFamily: "var(--type-display, 'Unique Display', Impact, sans-serif)",
      fontWeight: UNIQUE_WEIGHTS[weight], fontSize: size,
      lineHeight: 0.9, letterSpacing: '0', fontSynthesis: 'none',
      ...style,
    }}>{children}</Tag>
  );
}
