import { KakaoMapsApi } from '../types';

const SCRIPT_ID = 'kakao-map-sdk';
let sdkPromise: Promise<KakaoMapsApi> | undefined;

export function loadKakaoMapSdk(): Promise<KakaoMapsApi> {
  if (window.kakao?.maps) {
    return waitForSdkLoad(window.kakao.maps);
  }

  if (sdkPromise) return sdkPromise;

  const appKey = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY;

  if (!appKey) {
    return Promise.reject(
      new Error('VITE_KAKAO_JAVASCRIPT_KEY is not configured.'),
    );
  }

  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=services`;
    script.onload = () => {
      if (!window.kakao?.maps) {
        reject(new Error('Kakao Map SDK was not initialized.'));
        return;
      }

      window.kakao.maps.load(() => resolve(window.kakao!.maps));
    };
    script.onerror = () => reject(new Error('Kakao Map SDK failed to load.'));
    document.head.appendChild(script);
  });

  return sdkPromise;
}

function waitForSdkLoad(maps: KakaoMapsApi): Promise<KakaoMapsApi> {
  return new Promise((resolve) => maps.load(() => resolve(maps)));
}
