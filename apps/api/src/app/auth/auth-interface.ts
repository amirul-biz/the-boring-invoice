export interface GoogleUser {
  provider: string;
  providerId: string;
  email: string;
  name: string;
  picture: string;
}

export interface CreateUserData {
  name: string;
  email: string;
}

export interface JwtPayload {
  id: string;
  sub: string;
  name: string;
  email: string;
}
