/**
 * lib/account.ts — deleteMyAccount error mapping (t2).
 */

import { deleteMyAccount } from '@/lib/account';
const mockState = { configured: true };
const mockRpc = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@/lib/supabase', () => ({
  get supabaseConfigured() {
    return mockState.configured;
  },
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: { signOut: (...args: unknown[]) => mockSignOut(...args) },
  },
}));

const NOT_AVAILABLE =
  'Account deletion is not available yet. Nothing was deleted. Please try again later or contact support.';
const GENERIC =
  "Couldn't delete your account. Nothing was deleted. Check your connection and try again.";

beforeEach(() => {
  mockState.configured = true;
  mockRpc.mockReset();
  mockSignOut.mockReset();
  mockSignOut.mockResolvedValue({ error: null });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('deleteMyAccount', () => {
  it('rpc success → no error and local signOut', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    expect(await deleteMyAccount()).toEqual({ error: null });
    expect(mockRpc).toHaveBeenCalledWith('delete_my_account');
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('success still resolves if signOut rejects', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockSignOut.mockRejectedValue(new Error('no session'));
    expect(await deleteMyAccount()).toEqual({ error: null });
  });

  it.each([
    ['PGRST202', { code: 'PGRST202', message: 'x' }],
    ['42883', { code: '42883', message: 'x' }],
    ['message match', { code: 'XX000', message: 'Could not find the function public.delete_my_account' }],
  ])('missing function (%s) → "not available yet", no signOut', async (_n, err) => {
    mockRpc.mockResolvedValue({ data: null, error: err });
    expect(await deleteMyAccount()).toEqual({ error: NOT_AVAILABLE });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('other rpc error → generic error, no signOut', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '500', message: 'server' } });
    expect(await deleteMyAccount()).toEqual({ error: GENERIC });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('rpc throws → error result, no signOut, never throws', async () => {
    mockRpc.mockRejectedValue(new Error('network'));
    await expect(deleteMyAccount()).resolves.toEqual({ error: GENERIC });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('unconfigured → error, no rpc, no signOut', async () => {
    mockState.configured = false;
    const r = await deleteMyAccount();
    expect(r.error).toEqual(expect.any(String));
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
