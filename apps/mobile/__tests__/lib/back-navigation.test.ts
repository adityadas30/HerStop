import { backAction } from '@/lib/back-navigation';

describe('backAction', () => {
  it('goes back when there is a previous screen', () => {
    expect(backAction(true, '/(tabs)/profile')).toEqual({ type: 'back' });
  });

  it('replaces with the fallback when this is the first screen in the stack', () => {
    expect(backAction(false, '/(tabs)/profile')).toEqual({
      type: 'replace',
      href: '/(tabs)/profile',
    });
  });
});
