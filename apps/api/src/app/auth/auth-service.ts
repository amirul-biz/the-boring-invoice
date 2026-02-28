import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@prismaService';
import { User } from '@prisma/client';
import { Response } from 'express';
import { GoogleUser, JwtPayload } from './auth-interface';
import { findUserByEmail, createUser, getUserJwtPayload } from './auth-repository';
import { AUTH_DURATION } from './auth.constants';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateOrCreateUser(googleUser: GoogleUser, res: Response): Promise<User> {
    let user = await findUserByEmail(
      this.prisma,
      googleUser.email,
      this.logger,
    );

    if (user) {
      this.logger.log(`Existing user found: ${user.id}`);
    } else {
      user = await createUser(
        this.prisma,
        { name: googleUser.name, email: googleUser.email },
        this.logger,
      );
    }

    // Get JWT payload from user data
    const payload = await getUserJwtPayload(this.prisma, user.email, this.logger);

    // Generate access token
    const accessToken = this.generateAccessToken(payload);

    // Generate refresh token
    const refreshToken = this.generateRefreshToken(payload);

    // Set cookies
    this.setAccessTokenCookie(res, accessToken);
    this.setRefreshTokenCookie(res, refreshToken);

    return user;
  }

  // ── private helpers ───────────────────────────────────────────────────────

  private get isSecure(): boolean {
    return process.env.COOKIE_SECURE === 'true';
  }

  private get cookieOptions() {
    return {
      httpOnly: true,
      secure: this.isSecure,
      sameSite: this.isSecure ? 'none' as const : 'lax' as const,
    };
  }

  // ── cookie setters ────────────────────────────────────────────────────────

  setAccessTokenCookie(res: Response, token: string): void {
    res.cookie('access_token', token, {
      ...this.cookieOptions,
      maxAge: AUTH_DURATION.ACCESS_TOKEN_MS,
    });
  }

  setRefreshTokenCookie(res: Response, token: string): void {
    res.cookie('refresh_token', token, {
      ...this.cookieOptions,
      maxAge: AUTH_DURATION.REFRESH_TOKEN_MS,
    });
  }

  // ── token generators ──────────────────────────────────────────────────────

  generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: AUTH_DURATION.ACCESS_TOKEN_JWT,
    });
  }

  generateRefreshToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: AUTH_DURATION.REFRESH_TOKEN_JWT,
    });
  }

  // ── token validation ──────────────────────────────────────────────────────

  isAccessTokenValid(token: string): boolean {
    try {
      this.jwtService.verify(token, {
        secret: process.env.JWT_ACCESS_SECRET,
        ignoreExpiration: true,
      });
      return true;
    } catch {
      return false;
    }
  }

  isRefreshTokenValid(token: string): boolean {
    try {
      this.jwtService.verify(token, {
        secret: process.env.JWT_REFRESH_SECRET,
        ignoreExpiration: true,
      });
      return true;
    } catch {
      return false;
    }
  }

  isAccessTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    return decoded.exp * 1000 < Date.now();
  }

  isRefreshTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    return decoded.exp * 1000 < Date.now();
  }

  // ── revoke ────────────────────────────────────────────────────────────────

  revokeTokens(res: Response): void {
    res.clearCookie('access_token', { ...this.cookieOptions, path: '/' });
    res.clearCookie('refresh_token', { ...this.cookieOptions, path: '/' });
  }

  // ── decode ────────────────────────────────────────────────────────────────

  decodeToken(token: string): JwtPayload & { exp: number; iat: number } {
    return this.jwtService.decode(token) as JwtPayload & {
      exp: number;
      iat: number;
    };
  }
}
