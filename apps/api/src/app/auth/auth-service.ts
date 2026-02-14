import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@prismaService';
import { User } from '@prisma/client';
import { GoogleUser } from './auth-interface';
import { findUserByEmail, createUser } from './auth-repository';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async validateOrCreateUser(googleUser: GoogleUser): Promise<User> {
    const existingUser = await findUserByEmail(
      this.prisma,
      googleUser.email,
      this.logger,
    );

    if (existingUser) {
      this.logger.log(`Existing user found: ${existingUser.id}`);
      return existingUser;
    }

    return await createUser(
      this.prisma,
      { name: googleUser.name, email: googleUser.email },
      this.logger,
    );
  }
}
