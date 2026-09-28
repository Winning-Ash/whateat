export interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}

export interface KakaoMapInstance {
  relayout(): void;
  setCenter(position: KakaoLatLng): void;
}

export interface KakaoMarkerInstance {
  setMap(map: KakaoMapInstance | null): void;
  setPosition(position: KakaoLatLng): void;
}

export interface KakaoMapMouseEvent {
  latLng: KakaoLatLng;
}

export interface KakaoCircleInstance {
  setMap(map: KakaoMapInstance | null): void;
  setPosition(position: KakaoLatLng): void;
  setRadius(radius: number): void;
  setZIndex(zIndex: number): void;
}

export interface KakaoMapsApi {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMapInstance;
  Marker: new (options: {
    map?: KakaoMapInstance;
    position: KakaoLatLng;
  }) => KakaoMarkerInstance;
  Circle: new (options: {
    map?: KakaoMapInstance;
    center: KakaoLatLng;
    radius: number;
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity: number;
    strokeStyle: string;
    fillColor: string;
    fillOpacity: number;
    zIndex?: number;
  }) => KakaoCircleInstance;
  event: {
    addListener(
      target: KakaoMapInstance,
      type: 'click',
      handler: (event: KakaoMapMouseEvent) => void,
    ): void;
    removeListener(
      target: KakaoMapInstance,
      type: 'click',
      handler: (event: KakaoMapMouseEvent) => void,
    ): void;
  };
}

interface KakaoGlobal {
  maps: KakaoMapsApi;
}

declare global {
  interface Window {
    kakao?: KakaoGlobal;
  }
}
