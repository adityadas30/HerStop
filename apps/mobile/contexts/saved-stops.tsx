import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { MOCK_STOPS, type StopData } from '@/data/mock-stops';

interface SavedStopsContextValue {
  savedIds: ReadonlySet<string>;
  isSaved: (id: string) => boolean;
  toggleSaved: (id: string) => void;
  savedStops: StopData[];
}

const SavedStopsContext = createContext<SavedStopsContextValue>({
  savedIds: new Set(),
  isSaved: () => false,
  toggleSaved: () => {},
  savedStops: [],
});

export function SavedStopsProvider({ children }: { children: ReactNode }) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const toggleSaved = useCallback((id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds]);

  const savedStops = useMemo(
    () => MOCK_STOPS.filter((s) => savedIds.has(s.id)),
    [savedIds],
  );

  const value = useMemo(
    () => ({ savedIds, isSaved, toggleSaved, savedStops }),
    [savedIds, isSaved, toggleSaved, savedStops],
  );

  return (
    <SavedStopsContext.Provider value={value}>{children}</SavedStopsContext.Provider>
  );
}

export function useSavedStops() {
  return useContext(SavedStopsContext);
}
