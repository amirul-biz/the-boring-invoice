import { Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@prismaService';
import { User } from '@prisma/client';
import { CreateUserData } from './auth-interface';

export async function findUserByEmail(
  prisma: PrismaService,
  email: string,
  logger: Logger,
): Promise<User | null> {
  try {
    logger.log(`Looking up user by email: ${email}`);
    return await prisma.user.findUnique({ where: { email } });
  } catch (error) {
    logger.error(`Failed to find user by email: ${error.message}`, error.stack);
    throw new HttpException(
      'Failed to look up user',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function createUser(
  prisma: PrismaService,
  data: CreateUserData,
  logger: Logger,
): Promise<User> {
  try {
    logger.log(`Creating new user: ${data.email}`);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
      },
    });

    logger.log(`User created successfully with ID: ${user.id}`);
    return user;
  } catch (error) {
    logger.error(`Failed to create user: ${error.message}`, error.stack);

    if (error.code === 'P2002') {
      logger.log(`User already exists (race condition), fetching existing user`);
      return await findUserByEmail(prisma, data.email, logger);
    }

    throw new HttpException(
      'Failed to create user',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
