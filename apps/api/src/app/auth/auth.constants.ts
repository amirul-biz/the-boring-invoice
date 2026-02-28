export const OAUTH_GOOGLE_CONFIG = 'OAUTH_GOOGLE_CONFIG';

export interface OAuthGoogleConfig {
  clientID: string;
  clientSecret: string;
  callbackURL: string;
}

export const AUTH_DURATION = {
  /** Access token: 15 minutes (milliseconds for cookie maxAge) */
  ACCESS_TOKEN_MS:  15 * 60 * 1000,
  /** Access token: 15 minutes (string for JWT expiresIn) */
  ACCESS_TOKEN_JWT: '15m',

  /** Refresh token: 7 days (milliseconds for cookie maxAge) */
  REFRESH_TOKEN_MS:  7 * 24 * 60 * 60 * 1000,
  /** Refresh token: 7 days (string for JWT expiresIn) */
  REFRESH_TOKEN_JWT: '7d',
} as const;
