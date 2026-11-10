import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export type Page = 'planner' | 'plans' | 'signin' | 'pricing';
export type PlanRoute = { page: Page; planId?: string; reload?: boolean; edit?: boolean };
export const PAGE_ROUTES: Record<Page, string> = {
  planner: '#/planner', plans: '#/my-plans', signin: '#/sign-in', pricing: '#/pricing',
};
export function routeHash(route: PlanRoute): string {
  return route.planId !== undefined ? `#/planner/${encodeURIComponent(route.planId)}` : PAGE_ROUTES[route.page];
}
export function readPlanRoute(): PlanRoute {
  const hash = window.location.hash;
  if (hash.startsWith('#/planner/')) {
    try { return { page: 'planner', planId: decodeURIComponent(hash.slice('#/planner/'.length)) }; }
    catch { return { page: 'planner', planId: '' }; }
  }
  const page = (Object.keys(PAGE_ROUTES) as Page[]).find(p => PAGE_ROUTES[p] === hash);
  return { page: page ?? 'planner' };
}
type Pending = { route: PlanRoute; delta?: number; ready: boolean };

// Index our own entries so cancelling Back/Forward restores the original entry,
// not a duplicate that traps the user or silently destroys Forward history.
export function usePlanNavigation(apply: (route: PlanRoute) => void, blocks: (route: PlanRoute) => boolean) {
  const callbacks = useRef({ apply, blocks });
  useLayoutEffect(() => { callbacks.current = { apply, blocks }; });
  const current = useRef(readPlanRoute());
  const index = useRef(0);
  const restoring = useRef(false);
  const bypass = useRef(false);
  const seen = useRef(window.location.href);
  const [pending, setPending] = useState<Pending | null>(null);

  function write(route: PlanRoute, replace = false) {
    const url = new URL(window.location.href);
    url.hash = routeHash(route);
    if (!replace) index.current += 1;
    window.history[replace ? 'replaceState' : 'pushState']({ ...window.history.state, compassNavigation: index.current }, '', url);
    seen.current = window.location.href;
    current.current = route;
  }
  function navigate(route: PlanRoute, replace = false, force = false) {
    if (!force && callbacks.current.blocks(route)) { setPending({ route, ready: true }); return; }
    setPending(null);
    if (window.location.hash !== routeHash(route)) write(route, replace);
    callbacks.current.apply(route);
  }
  useEffect(() => {
    const stateIndex = window.history.state?.compassNavigation;
    index.current = typeof stateIndex === 'number' ? stateIndex : 0;
    write(current.current, true);
    callbacks.current.apply(current.current);
    const onHistory = () => {
      if (seen.current === window.location.href) return;
      seen.current = window.location.href;
      const target = readPlanRoute();
      const recordedIndex = window.history.state?.compassNavigation;
      // A fragment entered in the address bar creates a new same-document
      // entry without our state. Index it instead of overwriting its predecessor.
      const targetIndex = typeof recordedIndex === 'number' ? recordedIndex : index.current + 1;
      const delta = targetIndex - index.current;
      if (restoring.current) {
        restoring.current = false;
        setPending(p => p ? { ...p, ready: true } : null);
        return;
      }
      if (!bypass.current && callbacks.current.blocks(target)) {
        if (delta !== undefined && delta !== 0) {
          restoring.current = true;
          setPending({ route: target, delta, ready: false });
          window.history.go(-delta);
        } else {
          // A manually entered fragment has no indexed history entry yet.
          write(current.current, true);
          setPending({ route: target, ready: true });
        }
        return;
      }
      bypass.current = false;
      setPending(null);
      index.current = targetIndex;
      if (typeof recordedIndex !== 'number') write(target, true);
      current.current = target;
      callbacks.current.apply(target);
    };
    window.addEventListener('popstate', onHistory);
    window.addEventListener('hashchange', onHistory);
    return () => {
      window.removeEventListener('popstate', onHistory);
      window.removeEventListener('hashchange', onHistory);
    };
    // The callbacks ref keeps listeners current without resetting history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return {
    navigate,
    pending,
    cancel: () => setPending(null),
    confirm: () => {
      if (!pending?.ready) return;
      const target = pending;
      setPending(null);
      if (target.delta !== undefined) { bypass.current = true; window.history.go(target.delta); }
      else navigate(target.route, false, true);
    },
    // Saving changes only the address, not scroll, planner state or history depth.
    address: (route: PlanRoute) => write(route, true),
  };
}
