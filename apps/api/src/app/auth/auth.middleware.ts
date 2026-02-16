import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth-service';
import { JwtPayload } from './auth-interface';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);

  constructor(private readonly authService: AuthService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const accessToken = req.cookies?.['access_token'];
    const refreshToken = req.cookies?.['refresh_token'];

    if (!accessToken || !refreshToken) {
      this.logger.warn('Missing tokens');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const isAccessValid = this.authService.isAccessTokenValid(accessToken);
    const isRefreshValid = this.authService.isRefreshTokenValid(refreshToken);

    if (!isAccessValid || !isRefreshValid) {
      this.logger.warn('Invalid token detected');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const isAccessExpired = this.authService.isAccessTokenExpired(accessToken);
    const isRefreshExpired = this.authService.isRefreshTokenExpired(refreshToken);

    if (isRefreshExpired) {
      this.logger.warn('Refresh token expired');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (isAccessExpired) {
      this.logger.log('Access token expired, refreshing...');
      const decoded = this.authService.decodeToken(refreshToken);
      const payload: JwtPayload = { id: decoded.id, sub: decoded.sub, name: decoded.name, email: decoded.email };
      const newAccessToken = this.authService.generateAccessToken(payload);
      this.authService.setAccessTokenCookie(res, newAccessToken);
      req['user'] = payload;
      return next();
    }

    const decoded = this.authService.decodeToken(accessToken);
    const payload: JwtPayload = { id: decoded.id, sub: decoded.sub, name: decoded.name, email: decoded.email };
    req['user'] = payload;
    return next();
  }
}
