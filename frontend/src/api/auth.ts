import { CurrentUserResponse } from '../types';
import { apiRequest, getApiUrl } from './client';

export function getCurrentUser(): Promise<CurrentUserResponse> {
  return apiRequest<CurrentUserResponse>('/auth/me');
}

export function startKakaoLogin(): void {
  window.location.assign(getApiUrl('/auth/kakao'));
}

export function logout(): Promise<void> {
  return apiRequest<void>('/auth/logout', { method: 'POST' });
}

export function withdrawAccount(): Promise<void> {
  return apiRequest<void>('/users/me', { method: 'DELETE' });
}
