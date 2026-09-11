'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface GlobalSearchContextType {
  globalQuery: string;
  setGlobalQuery: (q: string) => void;
  rawQuery: string;
  setRawQuery: (q: string) => void;
}

const GlobalSearchContext = createContext<GlobalSearchContextType | undefined>(undefined);

export function GlobalSearchProvider({ children }: { children: React.ReactNode }) {
  const [globalQuery, setGlobalQuery] = useState('');
  const [rawQuery, setRawQuery] = useState('');

  return (
    <GlobalSearchContext.Provider value={{ globalQuery, setGlobalQuery, rawQuery, setRawQuery }}>
      {children}
    </GlobalSearchContext.Provider>
  );
}

export function useGlobalSearch() {
  const ctx = useContext(GlobalSearchContext);
  if (!ctx) {
    // Fallback for isolated unit tests without provider: return empty global query
    return { globalQuery: '', setGlobalQuery: () => {}, rawQuery: '', setRawQuery: () => {} } as GlobalSearchContextType;
  }
  return ctx;
}

// Reusable debounced input component for header
export function GlobalSearchInput() {
  const { rawQuery, setRawQuery, setGlobalQuery } = useGlobalSearch();
  const [local, setLocal] = useState(rawQuery);

  useEffect(() => {
    setLocal(rawQuery);
  }, [rawQuery]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setGlobalQuery(local);
      setRawQuery(local);
    }, 200);
    return () => clearTimeout(handle);
  }, [local, setGlobalQuery, setRawQuery]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocal(e.target.value);
  }, []);

  const clear = useCallback(() => {
    setLocal('');
  }, []);

  return (
    <div className="relative flex items-center">
      <input
        aria-label="Global Search"
        data-testid="global-search-input"
        placeholder="Search date, places, order no, KM…"
        value={local}
        onChange={handleChange}
        className="w-full md:w-64 lg:w-72 px-3 py-1.5 pr-8 border border-rule-line rounded-lg text-sm bg-paper-sheet focus:outline-none focus:ring-2 focus:ring-telemetry-cyan/30 focus:border-telemetry-cyan"
      />
      {local && (
        <button
          aria-label="Clear global search"
          data-testid="global-search-clear"
          onClick={clear}
          className="absolute right-2 text-on-surface-variant hover:text-on-surface text-xs"
        >
          ✕
        </button>
      )}
    </div>
  );
}
