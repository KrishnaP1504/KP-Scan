import { Platform, PermissionsAndroid, Linking } from 'react-native';
import { showAppAlert } from '../context/AlertContext';

export type PermissionStatus = 'granted' | 'denied' | 'blocked' | 'unavailable';

export async function checkCameraPermission(): Promise<boolean> {
  return Platform.OS === 'android'
    ? PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA)
    : true;
}

export function promptOpenSettings(title: string, message: string): void {
  showAppAlert({
    title,
    message,
    type: 'warning',
    buttons: [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          Linking.openSettings().catch(() => {
            showAppAlert({
              title: 'Settings Error',
              message: 'Unable to open device settings.',
              type: 'error',
            });
          });
        },
      },
    ],
  });
}

export async function requestCameraPermission(): Promise<PermissionStatus> {
  if (Platform.OS !== 'android') return 'granted';

  try {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
      title: 'Camera Access Required',
      message: 'KP Scan needs camera access to capture documents and automatically detect page edges.',
      buttonNeutral: 'Ask Me Later',
      buttonNegative: 'Cancel',
      buttonPositive: 'Grant Permission',
    });

    if (granted === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
    if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      promptOpenSettings(
        'Camera Permission Blocked',
        'Camera access is required for scanning documents. Please enable camera access in your device settings.'
      );
      return 'blocked';
    }
    return 'denied';
  } catch (err) {
    console.warn('Camera permission request error:', err);
    return 'unavailable';
  }
}

export async function ensureStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    const apiLevel = Number(Platform.Version);

    if (apiLevel >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        {
          title: 'Storage Access Required',
          message: 'KP Scan needs storage permission to save documents and images to your device.',
          buttonNegative: 'Cancel',
          buttonPositive: 'Allow Access',
        }
      );
      return (
        granted === PermissionsAndroid.RESULTS.GRANTED ||
        (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES))
      );
    } else {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      ]);

      const writeGranted =
        granted[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] ===
        PermissionsAndroid.RESULTS.GRANTED;
      const readGranted =
        granted[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] ===
        PermissionsAndroid.RESULTS.GRANTED;

      if (writeGranted || readGranted) return true;

      // Check if already granted
      const checkWrite = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
      );
      if (checkWrite) return true;

      promptOpenSettings(
        'Storage Permission Required',
        'Please allow storage access in Settings so KP Scan can save PDFs and images to your device.'
      );
      return false;
    }
  } catch (err) {
    console.warn('Storage permission error:', err);
    return true; // Fallback to let system attempt scoped storage write
  }
}

export async function requestGalleryReadPermission(): Promise<PermissionStatus> {
  if (Platform.OS !== 'android') return 'granted';

  try {
    const targetPermission =
      (Platform.Version as number) >= 33
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

    const granted = await PermissionsAndroid.request(targetPermission, {
      title: 'Photo Library Access',
      message: 'KP Scan needs access to your gallery to import documents for scanning.',
      buttonNegative: 'Cancel',
      buttonPositive: 'Allow',
    });

    return granted === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
  } catch (err) {
    console.warn('Storage permission request error:', err);
    return 'unavailable';
  }
}

export async function requestGalleryWritePermission(): Promise<boolean> {
  return ensureStoragePermission();
}

export const PermissionsUtil = {
  checkCameraPermission,
  requestCameraPermission,
  ensureStoragePermission,
  requestGalleryReadPermission,
  requestGalleryWritePermission,
  promptOpenSettings,
};
