import * as Location from 'expo-location';
import { getLocation } from '@/lib/location';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' },
  Accuracy: { Balanced: 3 },
}));

const requestPermission = jest.mocked(Location.requestForegroundPermissionsAsync);
const getPosition = jest.mocked(Location.getCurrentPositionAsync);

beforeEach(() => {
  jest.resetAllMocks();
  requestPermission.mockResolvedValue({
    status: Location.PermissionStatus.GRANTED,
    granted: true,
    canAskAgain: true,
    expires: 'never',
  });
});

describe('Explore location request', () => {
  it('returns granted only with the device coordinates', async () => {
    getPosition.mockResolvedValue({
      coords: {
        latitude: 0, longitude: 0, altitude: null, accuracy: 10,
        altitudeAccuracy: null, heading: null, speed: null,
      },
      timestamp: 0,
    });
    await expect(getLocation()).resolves.toEqual({
      status: 'granted', coords: { latitude: 0, longitude: 0 },
    });
    expect(getPosition).toHaveBeenCalledWith({ accuracy: Location.Accuracy.Balanced });
  });

  it('returns denied without requesting a position', async () => {
    requestPermission.mockResolvedValue({
      status: Location.PermissionStatus.DENIED,
      granted: false,
      canAskAgain: false,
      expires: 'never',
    });
    await expect(getLocation()).resolves.toEqual({ status: 'denied' });
    expect(getPosition).not.toHaveBeenCalled();
  });

  it('returns unavailable when permission is granted but the position fails', async () => {
    getPosition.mockRejectedValue(new Error('Position unavailable'));
    await expect(getLocation()).resolves.toEqual({ status: 'unavailable' });
  });

  it('returns unavailable if requesting permission fails', async () => {
    requestPermission.mockRejectedValue(new Error('Permission request failed'));
    await expect(getLocation()).resolves.toEqual({ status: 'unavailable' });
    expect(getPosition).not.toHaveBeenCalled();
  });

  it('does not log native error details that could contain location data', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      getPosition.mockRejectedValue(new Error('Native error with sensitive details'));
      await getLocation();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
