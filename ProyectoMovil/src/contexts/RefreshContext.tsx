import React, { createContext, useContext, useRef, useState } from 'react';

type RefreshHandler = () => Promise<void> | void;

type HandlerEntry = { fn: RefreshHandler; lastRun?: number; inFlight?: boolean };

type RefreshContextValue = {
  register: (id: string, handler: RefreshHandler) => void;
  unregister: (id: string) => void;
  triggerRefresh: () => Promise<void>;
  refreshing: boolean;
};

const RefreshContext = createContext<RefreshContextValue | null>(null);

export const RefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const handlersRef = useRef<Record<string, HandlerEntry>>({});
  const [refreshing, setRefreshing] = useState(false);
  // use ref to guard re-entrant calls synchronously (setState is async)
  const refreshingRef = useRef(false);
  // guard to avoid runaway nested triggers
  const triggerDepth = useRef(0);
  // debounce/single-flight: if a trigger is already scheduled or running, return the same promise
  const pendingTrigger = useRef<Promise<void> | null>(null);
  const debounceTimer = useRef<any>(null);
  // enable verbose logging only in development; set global.__REFRESH_DEBUG__ = true for extra logs
  const DEBUG = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

  const register = React.useCallback((id: string, handler: RefreshHandler) => {
    const existing = handlersRef.current[id];
    if (existing && existing.fn === handler) return;
    handlersRef.current[id] = { fn: handler, lastRun: existing?.lastRun };
    if (DEBUG) {
      try {
        // capture lightweight stack to help identify caller
        const stack = new Error().stack?.split('\n').slice(2, 6).join('\n') || '';
        console.log(`[RefreshContext] registered ${id} (total=${Object.keys(handlersRef.current).length})\n${stack}`);
      } catch (e) {
        console.log(`[RefreshContext] registered ${id}`);
      }
    }
  }, []);

  const unregister = React.useCallback((id: string) => {
    delete handlersRef.current[id];
    if (DEBUG) console.log(`[RefreshContext] unregistered ${id} (total=${Object.keys(handlersRef.current).length})`);
  }, []);

  const triggerRefresh = React.useCallback(async () => {
    if (DEBUG) console.log('[RefreshContext] triggerRefresh called');
    // If a trigger is already in flight or scheduled, return that promise (single-flight)
    if (pendingTrigger.current) return pendingTrigger.current;

    // Create a promise that will run the actual handlers after a tiny debounce
    pendingTrigger.current = new Promise<void>(async (resolvePromise) => {
      // debounce short window (200ms) to collapse rapid repeated triggers
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        if (DEBUG) console.log('[RefreshContext] debounce fired, executing handlers');
        // Protect against nested/recursive triggers
        if (refreshingRef.current) {
          if (DEBUG) console.log('[RefreshContext] already refreshing, skipping');
          resolvePromise();
          pendingTrigger.current = null;
          return;
        }
        if (triggerDepth.current > 3) {
          console.warn('[RefreshContext] triggerRefresh: max depth reached, aborting');
          resolvePromise();
          pendingTrigger.current = null;
          return;
        }
        try {
          triggerDepth.current += 1;
          refreshingRef.current = true;
          // Only set refreshing state if it wasn't already true to avoid extra renders
          if (!refreshing) setRefreshing(true);

          const MIN_INTERVAL_MS = 2000; // minimum time between runs for a given handler
          const now = Date.now();
          const entries = Object.entries(handlersRef.current || {});
          if (DEBUG) console.log(`[RefreshContext] triggerRefresh: preparing ${entries.length} handlers (depth ${triggerDepth.current})`);

          // Build promises to execute handlers in parallel, but time-gate per handler
          const promises = entries.map(async ([id, entry]) => {
            if (!entry || typeof entry.fn !== 'function') return;
            const last = entry.lastRun || 0;
            if (now - last < MIN_INTERVAL_MS) {
              // skip handler that ran recently
              if (DEBUG) console.log(`[RefreshContext] skipping handler ${id} (ran ${now - last}ms ago)`);
              return;
            }
            // mark in-flight to prevent concurrent double runs
            entry.inFlight = true;
            try {
              if (DEBUG) console.log(`[RefreshContext] calling handler ${id}`);
              // schedule as a macrotask to avoid layout-effect reentrancy
              await new Promise<void>((resolve) => setTimeout(resolve, 0));
              await Promise.resolve().then(() => entry.fn()).catch(err => console.warn(`[RefreshContext] handler ${id} threw`, err));
              // record last run on success
              entry.lastRun = Date.now();
              if (DEBUG) console.log(`[RefreshContext] handler ${id} finished`);
            } catch (e) {
              console.warn(`[RefreshContext] handler ${id} error`, e);
            } finally {
              entry.inFlight = false;
            }
          });

          // Run all handlers in parallel and wait for completion
          await Promise.all(promises);
        } catch (e) {
          // swallow errors but log
          console.warn('triggerRefresh handlers error', e);
        } finally {
          refreshingRef.current = false;
          // Only clear refreshing state if it was true
          if (refreshing) setRefreshing(false);
          triggerDepth.current = Math.max(0, triggerDepth.current - 1);
          // resolve the outer promise
          resolvePromise();
          pendingTrigger.current = null;
        }
      }, 200);
    });

    return pendingTrigger.current;
  }, [refreshing]);

  const value = React.useMemo(() => ({ register, unregister, triggerRefresh, refreshing }), [register, unregister, triggerRefresh, refreshing]);

  return (
    <RefreshContext.Provider value={value}>
      {children}
    </RefreshContext.Provider>
  );
};

export const useRefresh = () => {
  const ctx = useContext(RefreshContext);
  if (!ctx) throw new Error('useRefresh must be used within RefreshProvider');
  return ctx;
};

export default RefreshContext;
