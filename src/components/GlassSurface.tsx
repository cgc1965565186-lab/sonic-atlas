import type { HTMLAttributes, PropsWithChildren } from 'react';

export function GlassSurface({ className = '', children, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={`glass-surface ${className}`} {...props}>
      {children}
    </div>
  );
}
