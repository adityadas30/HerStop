import { canToggleSave, shouldShowEmptySavedState, withSavedState } from '@/lib/saved-view';

describe('canToggleSave', () => {
  it('allows saving once nothing is restoring (guest or signed in alike)', () => {
    expect(canToggleSave({ authLoading: false, savedLoading: false })).toBe(true);
  });

  it('waits while auth is restoring the session', () => {
    expect(canToggleSave({ authLoading: true, savedLoading: false })).toBe(false);
  });

  it('waits while the saved list is loading, so the restore cannot wipe the tap', () => {
    expect(canToggleSave({ authLoading: false, savedLoading: true })).toBe(false);
  });
});

describe('withSavedState', () => {
  it('adds and removes an id without mutating the original', () => {
    const original = new Set(['a']);
    const added = withSavedState(original, 'b', true);
    expect([...added].sort()).toEqual(['a', 'b']);
    expect([...original]).toEqual(['a']);
    expect([...withSavedState(added, 'a', false)]).toEqual(['b']);
  });

  it('undoes an optimistic save when applied with the opposite value', () => {
    const before = new Set(['a']);
    const optimistic = withSavedState(before, 'b', true);
    const rolledBack = withSavedState(optimistic, 'b', !true);
    expect([...rolledBack]).toEqual([...before]);
  });

  it('undoes an optimistic unsave the same way', () => {
    const before = new Set(['a', 'b']);
    const optimistic = withSavedState(before, 'b', false);
    const rolledBack = withSavedState(optimistic, 'b', !false);
    expect([...rolledBack].sort()).toEqual([...before].sort());
  });
});

describe('shouldShowEmptySavedState', () => {
  const base = { hasStops: false, loading: false, showGuestCard: false, syncError: null };

  it('shows the empty state for a signed-in user with nothing saved', () => {
    expect(shouldShowEmptySavedState(base)).toBe(true);
  });

  it('hides it when a load error is shown, so the screen never says both', () => {
    expect(shouldShowEmptySavedState({ ...base, syncError: 'Could not load saved stops.' })).toBe(
      false,
    );
  });

  it('hides it while loading, with stops, or when the guest card is showing', () => {
    expect(shouldShowEmptySavedState({ ...base, loading: true })).toBe(false);
    expect(shouldShowEmptySavedState({ ...base, hasStops: true })).toBe(false);
    expect(shouldShowEmptySavedState({ ...base, showGuestCard: true })).toBe(false);
  });
});
