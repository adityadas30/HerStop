import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/contexts/auth';
import { type StopData } from '@/data/mock-stops';
import { getSavedStops, getStops, toggleSaveStop } from '@/lib/api';

interface SavedStopsContextValue {
  savedIds: ReadonlySet<string>;
  isSaved: (id: string) => boolean;
  toggleSaved: (id: string) => void;
  savedStops: StopData[];
  /** True while a signed-in user's saved list is being restored from Supabase. */
  loading: boolean;
  /** Quiet inline message when a change could not be synced. Null when all is well. */
  syncError: string | null;
}

const SavedStopsContext = createContext<SavedStopsContextValue>({
  savedIds: new Set(),
  isSaved: () => false,
  toggleSaved: () => {},
  savedStops: [],
  loading: false,
  syncError: null,
});

export function SavedStopsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [stops, setStops] = useState<StopData[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Bumped every time we load or clear the list. An in-flight request compares
  // the value it started with and throws its result away if anything changed
  // meanwhile — without this, signing out mid-request would let the previous
  // user's rows land in state after the list was already cleared.
  const loadIdRef = useRef(0);

  // The stop catalog, used to turn saved ids into cards. Reading it through
  // getStops() (live Supabase, with the mock fallback) is what lets a stop that
  // exists only in Supabase show up in the Saved tab — filtering MOCK_STOPS
  // here would silently drop every live stop.
  useEffect(() => {
    let isMounted = true;
    getStops().then((rows) => {
      if (isMounted) setStops(rows);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Load the user's saved stops on sign-in; clear them on sign-out.
  //
  // While auth is still restoring the session (cold launch), we don't yet know
  // whether there's a signed-in user. Treating that window as "no user" would
  // briefly clear a returning user's saved ids and show the guest empty state,
  // so we stay loading and skip both branches until auth has resolved.
  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    const loadId = ++loadIdRef.current;

    if (!userId) {
      setSavedIds(new Set());
      setSyncError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    getSavedStops(userId).then((rows) => {
      if (loadIdRef.current !== loadId) return; // signed out, or switched user
      setSavedIds(new Set(rows.map((row) => row.stop_id)));
      setLoading(false);
    });
  }, [userId, authLoading]);

  const toggleSaved = useCallback(
    (id: string) => {
      const nextSaved = !savedIds.has(id);

      // Optimistic: the bookmark flips immediately for guests and signed-in
      // users alike, so the tap never feels laggy.
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (nextSaved) next.add(id);
        else next.delete(id);
        return next;
      });
      setSyncError(null);

      // Guests keep saves in memory for this session only — nothing to sync.
      if (!userId) return;

      const loadId = loadIdRef.current;
      void toggleSaveStop(id, nextSaved).then(({ error }) => {
        // Same guard as the loader: a sign-out that happened while this write
        // was in flight must not be undone by its response.
        if (loadIdRef.current !== loadId) return;
        if (!error) return;

        // The write failed (offline, RLS, missing table). Put the bookmark back
        // where it was so the UI matches what Supabase actually stores.
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (nextSaved) next.delete(id);
          else next.add(id);
          return next;
        });
        setSyncError(error);
      });
    },
    [savedIds, userId],
  );

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds]);

  // A saved id with no matching stop — deleted server-side, or a stale row — is
  // skipped instead of rendered as a broken card.
  const savedStops = useMemo(
    () => stops.filter((stop) => savedIds.has(stop.id)),
    [stops, savedIds],
  );

  const value = useMemo(
    () => ({ savedIds, isSaved, toggleSaved, savedStops, loading, syncError }),
    [savedIds, isSaved, toggleSaved, savedStops, loading, syncError],
  );

  return (
    <SavedStopsContext.Provider value={value}>{children}</SavedStopsContext.Provider>
  );
}

export function useSavedStops() {
  return useContext(SavedStopsContext);
}
