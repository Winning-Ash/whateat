export interface AuthUser {
  id: string;
  nickname: string;
  createdAt: string;
}

export interface CurrentUserResponse {
  user: AuthUser;
}
