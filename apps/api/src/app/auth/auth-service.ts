import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@prismaService';
import { User } from '@prisma/client';
import { Response } from 'express';
import { GoogleUser, JwtPayload } from './auth-interface';
import { findUserByEmail, createUser, getUserJwtPayload } from './auth-repository';

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

  setAccessTokenCookie(res: Response, token: string): void {
    res.cookie('access_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, 
    });
  }

  setRefreshTokenCookie(res: Response, token: string): void {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }


  generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '15m', 
    });
  }


  generateRefreshToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '3h', 
    });
  }


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

  revokeTokens(res: Response): void {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
  }

  decodeToken(token: string): JwtPayload & { exp: number; iat: number } {
    return this.jwtService.decode(token) as JwtPayload & {
      exp: number;
      iat: number;
    };
  }
}
