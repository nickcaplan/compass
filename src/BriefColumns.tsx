import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';

// Match the empty right-hand controls to their actual left-hand peers.
// Observe real content so font changes and pill wrapping cannot stale a height.
export function BriefColumns({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const columns = ref.current!;
    const name = columns.querySelector('#f-name')!;
    const market = columns.querySelector('[aria-labelledby="g-market"]')!;
    const update = () => {
      columns.style.setProperty('--brief-name-height', `${name.getBoundingClientRect().height}px`);
      columns.style.setProperty('--brief-market-height', `${market.getBoundingClientRect().height}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(name); observer.observe(market);
    return () => observer.disconnect();
  }, []);
  return <div className="brief-columns" ref={ref}>{children}</div>;
}
