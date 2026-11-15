import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';

// Animate the actual measured content, including wrapping and font changes.
// The underlying height stays automatic, so no stale fixed height can clip it.
export function AnimatedKpiField({ children }: { children: ReactNode }) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const field = fieldRef.current!;
    const content = contentRef.current!;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let previousHeight = field.getBoundingClientRect().height;
    let animation: Animation | undefined;
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(field);
      const targetHeight = content.getBoundingClientRect().height +
        parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) +
        parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      if (Math.abs(targetHeight - previousHeight) < 0.5) return;
      const from = animation && animation.playState !== 'finished' && animation.playState !== 'idle'
        ? field.getBoundingClientRect().height : previousHeight;
      animation?.cancel();
      if (!reducedMotion.matches && Math.abs(targetHeight - from) > 1) {
        animation = field.animate([
          { height: `${from}px`, overflow: 'clip' },
          { height: `${targetHeight}px`, overflow: 'clip' },
        ], { duration: 280, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
      }
      previousHeight = targetHeight;
    });
    const stop = () => { if (reducedMotion.matches) animation?.cancel(); };
    observer.observe(content);
    reducedMotion.addEventListener('change', stop);
    return () => { observer.disconnect(); animation?.cancel(); reducedMotion.removeEventListener('change', stop); };
  }, []);
  return <div className="field planning-step kpi-field" ref={fieldRef}>
    <div className="kpi-content" ref={contentRef}>{children}</div>
  </div>;
}
