import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GoogleOauthGuard } from './auth-google-auth-guard';
import { AuthService } from './auth-service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(GoogleOauthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  async googleLogin() {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleOauthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(@Req() req, @Res() res) {
    await this.authService.validateOrCreateUser(req.user, res);
    return res.redirect(`${process.env.NG_APP_CLIENT_URL}/business-entity`);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout and clear auth cookies' })
  async logout(@Res() res) {
    this.authService.revokeTokens(res);
    return res.status(200).json({ message: 'Logged out successfully' });
  }
}
