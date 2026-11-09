import { CurrentUserResponse } from '../types';
import { apiRequest, getApiUrl } from './client';

export const KAKAO_LOGIN_PENDING_KEY = 'whateat_kakao_login_pending';

export function getCurrentUser(): Promise<CurrentUserResponse> {
  return apiRequest<CurrentUserResponse>('/auth/me');
}

export function startKakaoLogin(): void {
  try {
    window.sessionStorage.setItem(KAKAO_LOGIN_PENDING_KEY, 'true');
  } catch {
    // Allow login even when browser storage is unavailable.
  }
  window.location.assign(getApiUrl('/auth/kakao'));
}

export function logout(): Promise<void> {
  return apiRequest<void>('/auth/logout', { method: 'POST' });
}

export function withdrawAccount(): Promise<void> {
  return apiRequest<void>('/users/me', { method: 'DELETE' });
}
