import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@prismaService';
import { OAUTH_GOOGLE_CONFIG, OAuthGoogleConfig } from './auth.constants';
import { AuthController } from './auth-controller';
import { AuthService } from './auth-service';
import { GoogleOauthGuard } from './auth-google-auth-guard';
import { GoogleStrategy } from './auth-google.strategy';

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: OAUTH_GOOGLE_CONFIG,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): OAuthGoogleConfig => ({
        clientID: configService.get<string>('OAUTH_CLIENT_ID'),
        clientSecret: configService.get<string>('OAUTH_SECRET'),
        callbackURL: configService.get<string>('OAUTH_CALLBACK_URL'),
      }),
    },
    AuthService,
    PrismaService,
    GoogleStrategy,
    GoogleOauthGuard,
  ],
})
export class AuthModule {}
