# NestJS Best Practices — Comprehensive Developer Guide

> A battle-tested reference for building scalable, secure, and maintainable NestJS applications.

---

## Table of Contents

1. [Project Structure & Architecture](#1-project-structure--architecture)
2. [Module Design](#2-module-design)
3. [Controllers](#3-controllers)
4. [Services & Business Logic](#4-services--business-logic)
5. [DTOs & Validation](#5-dtos--validation)
6. [Error Handling & Exceptions](#6-error-handling--exceptions)
7. [Logging](#7-logging)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Security](#9-security)
10. [Database & Repository Pattern](#10-database--repository-pattern)
11. [Configuration Management](#11-configuration-management)
12. [Testing](#12-testing)
13. [Performance & Scalability](#13-performance--scalability)
14. [Code Style & Conventions](#14-code-style--conventions)
15. [Advanced Patterns (CQRS, DDD, Clean Architecture)](#15-advanced-patterns)

---

## 1. Project Structure & Architecture

### Recommended Folder Structure

```
src/
├── common/                   # Shared utilities, decorators, guards, pipes
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   ├── pipes/
│   └── constants/
├── config/                   # Configuration files & validation schemas
├── modules/
│   ├── auth/
│   │   ├── dto/
│   │   ├── strategies/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.module.ts
│   │   └── auth.guard.ts
│   ├── users/
│   │   ├── dto/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.repository.ts
│   │   └── users.module.ts
│   └── ...
├── prisma/                   # Prisma service (global DB client)
│   └── prisma.service.ts
├── app.module.ts
└── main.ts

prisma/                       # Prisma root (outside src/)
├── schema.prisma
├── migrations/
└── seed.ts
```

### Rules
- **Feature-based modules** — group everything related to a feature in one folder.
- Avoid placing business logic in `app.module.ts`. Keep it as the root orchestrator only.
- Shared code (guards, decorators, interceptors) belongs in `common/`.
- Never import a module's internal service directly — expose it via the module's `exports` array.

---

## 2. Module Design

### ✅ Do
```typescript
// With Prisma, no need for TypeOrmModule.forFeature — PrismaService is injected directly
@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService], // Only export what other modules need
})
export class UsersModule {}
```

### ✅ Use `forRoot` / `forRootAsync` for Global Config
```typescript
// app.module.ts
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
    DATABASE_URL: Joi.string().required(),
    JWT_SECRET: Joi.string().required(),
  }),
})
```

### ✅ Use Dynamic Modules for Reusable Libraries
```typescript
@Module({})
export class NotificationModule {
  static forRoot(options: NotificationOptions): DynamicModule {
    return {
      module: NotificationModule,
      providers: [
        { provide: NOTIFICATION_OPTIONS, useValue: options },
        NotificationService,
      ],
      exports: [NotificationService],
    };
  }
}
```

### ❌ Don't
- Do not create a single `SharedModule` that exports everything — it causes tight coupling.
- Do not use `@Global()` unless it's truly a global utility (e.g., `ConfigModule`, `LoggerModule`).

---

## 3. Controllers

### Responsibilities
Controllers should **only** handle HTTP concerns: routing, request/response mapping, calling services. No business logic here.

### ✅ Best Practices

```typescript
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiTags('Users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.findOneOrFail(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(createUserDto);
  }
}
```

### Rules
- Always use **HTTP status codes explicitly** with `@HttpCode()`.
- Use **pipes at the parameter level** for ID validation (`ParseUUIDPipe`, `ParseIntPipe`).
- Return **response DTOs**, not raw entities — never leak DB structure to the client.
- Group related endpoints with `@ApiTags()` for Swagger documentation.
- Apply guards at the **controller level** if all routes need the same protection, or at **method level** for exceptions.

---

## 4. Services & Business Logic

### Responsibilities
Services own all business logic. They are testable, injectable, and independent of the HTTP layer.

### ✅ Best Practices

```typescript
@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly logger: Logger,
  ) {}

  async findOneOrFail(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const exists = await this.usersRepository.findByEmail(dto.email);
    if (exists) {
      throw new ConflictException('Email already in use');
    }
    const hashed = await bcrypt.hash(dto.password, 12);
    return this.usersRepository.create({ ...dto, password: hashed });
  }
}
```

### Rules
- Services should throw **NestJS built-in exceptions** (`NotFoundException`, `ConflictException`, etc.) — not raw errors.
- Keep methods **small and single-purpose** (SRP).
- Inject dependencies via the **constructor** — never instantiate services manually.
- Avoid circular dependencies by restructuring or using `forwardRef()` sparingly.

---

## 5. DTOs & Validation

### Use `class-validator` + `class-transformer`

```bash
npm install class-validator class-transformer
```

### Global Validation Pipe (main.ts)
```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,          // Strip unknown properties
    forbidNonWhitelisted: true, // Throw on unknown properties
    transform: true,          // Auto-transform types
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```

### ✅ DTO Example
```typescript
export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsEmail()
  @Transform(({ value }) => value.toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter and one number',
  })
  password: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole = UserRole.USER;
}
```

### ✅ Response DTO with `@Exclude()`
```typescript
export class UserResponseDto {
  id: string;
  name: string;
  email: string;
  createdAt: Date;

  // Password is never exposed
  @Exclude()
  password: string;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
```

```typescript
// In controller or interceptor
return new UserResponseDto(user);
// Or use ClassSerializerInterceptor globally
```

---

## 6. Error Handling & Exceptions

### Global Exception Filter

```typescript
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message;

    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Prisma known errors (constraint violations, not found, etc.)
      switch (exception.code) {
        case 'P2002': // Unique constraint violation
          status = HttpStatus.CONFLICT;
          message = `Duplicate value on field: ${(exception.meta?.target as string[])?.join(', ')}`;
          errorCode = 'UNIQUE_CONSTRAINT_VIOLATION';
          break;
        case 'P2025': // Record not found
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          errorCode = 'RECORD_NOT_FOUND';
          break;
        case 'P2003': // Foreign key constraint failed
          status = HttpStatus.BAD_REQUEST;
          message = 'Related record not found';
          errorCode = 'FOREIGN_KEY_VIOLATION';
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          message = 'Database operation failed';
          errorCode = `PRISMA_${exception.code}`;
      }

    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided';
      errorCode = 'PRISMA_VALIDATION_ERROR';
    }

    this.logger.error(
      `[${request.method}] ${request.url} - ${status}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(status).json({
      statusCode: status,
      message,
      errorCode,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

### Register Globally
```typescript
// main.ts
app.useGlobalFilters(new GlobalExceptionFilter(new Logger('ExceptionFilter')));
```

### Built-in Exception Reference

| Exception                    | HTTP Status |
|------------------------------|-------------|
| `BadRequestException`        | 400         |
| `UnauthorizedException`      | 401         |
| `ForbiddenException`         | 403         |
| `NotFoundException`          | 404         |
| `ConflictException`          | 409         |
| `UnprocessableEntityException` | 422       |
| `InternalServerErrorException` | 500       |

### ✅ Domain-Specific Custom Exceptions
```typescript
export class UserAlreadyExistsException extends ConflictException {
  constructor(email: string) {
    super({
      message: `User with email "${email}" already exists`,
      errorCode: 'USER_ALREADY_EXISTS',
    });
  }
}
```

---

## 7. Logging

### Use NestJS Built-in Logger (or Pino/Winston for Production)

```typescript
// Recommended: Use Pino for structured JSON logs in production
npm install nestjs-pino pino-http pino-pretty
```

```typescript
// main.ts
import { Logger } from 'nestjs-pino';

const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
```

### Logging Rules

```typescript
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name); // Use class name as context

  async create(dto: CreateUserDto): Promise<User> {
    this.logger.log(`Creating user with email: ${dto.email}`);
    try {
      const user = await this.usersRepository.create(dto);
      this.logger.log(`User created successfully: ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error(`Failed to create user`, error.stack);
      throw error;
    }
  }
}
```

### Log Levels — When to Use What

| Level     | Use Case                                      |
|-----------|-----------------------------------------------|
| `verbose` | Detailed debug info (dev only)                |
| `debug`   | Debug flow, internal state                    |
| `log`     | Standard application events                   |
| `warn`    | Recoverable issues, deprecations              |
| `error`   | Failures, exceptions, unexpected states       |
| `fatal`   | App cannot continue (crash-level)             |

### ✅ Never Log Sensitive Data
```typescript
// ❌ Bad
this.logger.log(`User login: ${dto.email} / ${dto.password}`);

// ✅ Good
this.logger.log(`User login attempt: ${dto.email}`);
```

---

## 8. Authentication & Authorization

### JWT with HTTP-Only Cookies (Recommended)

```typescript
// auth.service.ts
async login(user: User): Promise<{ accessToken: string; refreshToken: string }> {
  const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

  const accessToken = this.jwtService.sign(payload, {
    secret: this.configService.get('JWT_ACCESS_SECRET'),
    expiresIn: '15m',
  });

  const refreshToken = this.jwtService.sign(payload, {
    secret: this.configService.get('JWT_REFRESH_SECRET'),
    expiresIn: '7d',
  });

  // Store hashed refresh token in DB
  await this.usersService.saveRefreshToken(user.id, refreshToken);

  return { accessToken, refreshToken };
}
```

```typescript
// auth.controller.ts — Set tokens as HTTP-only cookies
@Post('login')
async login(
  @Body() loginDto: LoginDto,
  @Res({ passthrough: true }) res: Response,
) {
  const user = await this.authService.validateUser(loginDto);
  const tokens = await this.authService.login(user);

  res.cookie('access_token', tokens.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie('refresh_token', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return { message: 'Login successful' };
}
```

### RBAC with Custom Decorator + Guard

```typescript
// roles.decorator.ts
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

// roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user?.role === role);
  }
}

// Usage
@Get('admin')
@Roles(Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
getAdminData() { ... }
```

---

## 9. Security

### Essential Security Middleware

```bash
npm install helmet @nestjs/throttler
```

```typescript
// main.ts
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // HTTP security headers
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  await app.listen(process.env.PORT ?? 3000);
}
```

### Rate Limiting

```typescript
// app.module.ts
ThrottlerModule.forRoot([{
  ttl: 60000,  // 1 minute window
  limit: 100,  // max 100 requests per window
}])

// Tighter limit for auth routes
@UseGuards(ThrottlerGuard)
@Throttle({ default: { ttl: 60000, limit: 5 } })
@Post('auth/login')
async login() { ... }
```

### Security Checklist

- ✅ Use `helmet()` for security headers
- ✅ Enable CORS with explicit allowed origins (no `*` in production)
- ✅ Use `@nestjs/throttler` for rate limiting
- ✅ Store passwords with `bcrypt` (rounds ≥ 12)
- ✅ Never return passwords or secrets in responses
- ✅ Validate and sanitize all inputs with `ValidationPipe`
- ✅ Use environment variables — never hardcode secrets
- ✅ Use HTTPS in production
- ✅ Set short JWT access token expiry (≤ 15 min)
- ✅ Rotate refresh tokens on each use (Refresh Token Rotation)
- ✅ Use `httpOnly`, `secure`, `sameSite=strict` for cookies

---

## 10. Database & Repository Pattern (Prisma)

### Setup — PrismaService

```typescript
// src/prisma/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}

// src/prisma/prisma.module.ts
@Global() // Make PrismaService available everywhere without re-importing
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### Prisma Schema Best Practices

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String    @id @default(uuid())
  email     String    @unique
  name      String
  password  String
  role      Role      @default(USER)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime? // Soft delete

  refreshTokens RefreshToken[]

  @@map("users") // snake_case table name
}

model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("refresh_tokens")
}

enum Role {
  USER
  ADMIN
  MODERATOR
}
```

### Repository Pattern with Prisma

```typescript
// users.repository.ts
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id, deletedAt: null },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findAll(params: {
    page: number;
    limit: number;
    where?: Prisma.UserWhereInput;
  }): Promise<{ data: User[]; total: number }> {
    const { page, limit, where } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: { ...where, deletedAt: null },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: { ...where, deletedAt: null } }),
    ]);

    return { data, total };
  }
}
```

### Transaction Handling with Prisma

```typescript
// Method 1: $transaction with array (parallel, atomic)
const [user, profile] = await this.prisma.$transaction([
  this.prisma.user.create({ data: userData }),
  this.prisma.profile.create({ data: profileData }),
]);

// Method 2: Interactive transactions (sequential, with logic)
async transferFunds(fromId: string, toId: string, amount: number) {
  return this.prisma.$transaction(async (tx) => {
    const from = await tx.account.findUniqueOrThrow({ where: { id: fromId } });

    if (from.balance < amount) {
      throw new BadRequestException('Insufficient funds');
    }

    await tx.account.update({
      where: { id: fromId },
      data: { balance: { decrement: amount } },
    });

    await tx.account.update({
      where: { id: toId },
      data: { balance: { increment: amount } },
    });
  });
}
```

### Selecting Fields — Never Over-fetch

```typescript
// ✅ Select only what you need — never return password by default
async findById(id: string) {
  return this.prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      // password: false (omitted = not returned)
    },
  });
}

// ✅ Reusable select object
export const userPublicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;
```

### Prisma Error Code Reference

| Code    | Meaning                          | Handle As          |
|---------|----------------------------------|--------------------|
| `P2002` | Unique constraint violation      | 409 Conflict       |
| `P2025` | Record not found                 | 404 Not Found      |
| `P2003` | Foreign key constraint failed    | 400 Bad Request    |
| `P2014` | Required relation violation      | 400 Bad Request    |
| `P2016` | Query interpretation error       | 400 Bad Request    |

---

## 11. Configuration Management

### Typed Config with Validation

```typescript
// config/database.config.ts
export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
}));

// Injecting typed config
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(configService: ConfigService) {
    super({
      datasources: {
        db: { url: configService.get('DATABASE_URL') },
      },
      log: configService.get('NODE_ENV') === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
    });
  }
}
```

### `.env` File Structure

```env
# App
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database (Prisma uses a single connection URL)
DATABASE_URL="postgresql://postgres:secret@localhost:5432/myapp_db?schema=public"

# JWT
JWT_ACCESS_SECRET=your_access_secret_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Security
ALLOWED_ORIGINS=http://localhost:3000,https://myapp.com
BCRYPT_ROUNDS=12
```

---

## 12. Testing

### Unit Testing — Service Layer

```typescript
describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<UsersRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: {
            findById: jest.fn(),
            findByEmail: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(UsersRepository);
  });

  it('should throw NotFoundException when user not found', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.findOneOrFail('non-existent-id')).rejects.toThrow(NotFoundException);
  });

  it('should return a user when found', async () => {
    const mockUser = { id: '1', email: 'test@test.com' } as User;
    repository.findById.mockResolvedValue(mockUser);
    const result = await service.findOneOrFail('1');
    expect(result).toEqual(mockUser);
  });
});
```

### Unit Testing with Prisma Mock (using `jest-mock-extended`)

```bash
npm install -D jest-mock-extended
```

```typescript
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

describe('UsersRepository', () => {
  let repository: UsersRepository;
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();

    const module = await Test.createTestingModule({
      providers: [
        UsersRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get<UsersRepository>(UsersRepository);
  });

  it('should return null when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const result = await repository.findById('non-existent');
    expect(result).toBeNull();
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'non-existent', deletedAt: null },
    });
  });
});
```

### E2E Testing

```typescript
describe('UsersController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => await app.close());

  it('GET /users/:id - should return 401 without auth', () => {
    return request(app.getHttpServer())
      .get('/users/some-id')
      .expect(401);
  });
});
```

### Testing Pyramid

```
        /\
       /e2e\        ← Few, slow, test full flows
      /------\
     / integ  \     ← Some, test service + DB
    /----------\
   /  unit tests \  ← Many, fast, isolated
  /--------------\
```

---

## 13. Performance & Scalability

### Response Caching

```typescript
// Use cache-manager for in-memory or Redis caching
@Injectable()
export class UsersService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async findOne(id: string): Promise<User> {
    const cached = await this.cacheManager.get<User>(`user:${id}`);
    if (cached) return cached;

    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException();

    await this.cacheManager.set(`user:${id}`, user, 300); // TTL: 5 min
    return user;
  }
}
```

### Use Interceptors for Cross-Cutting Concerns

```typescript
// Logging interceptor
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        this.logger.log(`[${req.method}] ${req.url} - ${ms}ms`);
      }),
    );
  }
}
```

### Pagination — Always Paginate List Endpoints

```typescript
export class PaginationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit: number = 20;
}

// In repository (Prisma)
async findAll(dto: PaginationDto): Promise<{ data: User[]; total: number }> {
  const skip = (dto.page - 1) * dto.limit;

  const [data, total] = await this.prisma.$transaction([
    this.prisma.user.findMany({
      where: { deletedAt: null },
      skip,
      take: dto.limit,
      orderBy: { createdAt: 'desc' },
      select: userPublicSelect,
    }),
    this.prisma.user.count({ where: { deletedAt: null } }),
  ]);

  return { data, total };
}
```

---

## 14. Code Style & Conventions

### Naming Conventions

| Entity            | Convention            | Example                    |
|-------------------|-----------------------|----------------------------|
| Files             | kebab-case            | `users.service.ts`         |
| Classes           | PascalCase            | `UsersService`             |
| Methods/Variables | camelCase             | `findUserById()`           |
| Constants         | UPPER_SNAKE_CASE      | `JWT_SECRET`               |
| Interfaces        | PascalCase (no `I`)   | `UserPayload`              |
| Enums             | PascalCase            | `UserRole`                 |
| Database Tables   | snake_case plural     | `user_sessions`            |

### General Rules

- **Single Responsibility**: One class = one purpose.
- **DI over Instantiation**: Always inject dependencies, never `new MyService()`.
- **Async/Await**: Always use async/await — avoid raw `.then()` chains.
- **Barrel Exports**: Use `index.ts` barrel files in modules to clean up imports.
- **Readonly Constructor Params**: Use `private readonly` in constructor injections.
- **No Magic Numbers**: Extract numbers/strings into named constants.

---

## 15. Advanced Patterns

### CQRS (Command Query Responsibility Segregation)

```typescript
// install: npm install @nestjs/cqrs

// Command
export class CreateUserCommand {
  constructor(public readonly dto: CreateUserDto) {}
}

// Command Handler
@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute(command: CreateUserCommand): Promise<User> {
    return this.usersRepository.create(command.dto);
  }
}

// Query
export class GetUserQuery {
  constructor(public readonly userId: string) {}
}

// Query Handler
@QueryHandler(GetUserQuery)
export class GetUserHandler implements IQueryHandler<GetUserQuery> {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute(query: GetUserQuery): Promise<User> {
    return this.usersRepository.findById(query.userId);
  }
}

// In Controller (dispatch via CommandBus / QueryBus)
@Post()
async create(@Body() dto: CreateUserDto) {
  return this.commandBus.execute(new CreateUserCommand(dto));
}
```

### Clean Architecture Layer Flow

```
Request → Controller → Use Case (Service) → Domain → Repository → DB
                    ↑                    ↑
              DTO (Input)          Entity (Domain Object)
```

### Domain-Driven Design (DDD) Key Concepts

```typescript
// Value Object — immutable, no identity
export class Email {
  private readonly value: string;

  constructor(email: string) {
    if (!this.isValid(email)) throw new BadRequestException('Invalid email');
    this.value = email.toLowerCase();
  }

  toString(): string { return this.value; }
  private isValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

// Aggregate Root — consistency boundary
export class User {
  private _events: DomainEvent[] = [];

  static create(props: CreateUserProps): User {
    const user = new User(props);
    user.addEvent(new UserCreatedEvent(user.id));
    return user;
  }

  getDomainEvents(): DomainEvent[] { return this._events; }
  clearEvents(): void { this._events = []; }
}
```

---

## Quick Reference Checklist

### Before Every PR

- [ ] All inputs validated with `class-validator`
- [ ] No sensitive data logged or returned
- [ ] Custom exceptions used (not generic `Error`)
- [ ] Services throw `HttpException` subclasses, not custom errors
- [ ] Database queries paginated where applicable
- [ ] No hardcoded secrets or magic numbers
- [ ] Unit tests cover happy path + edge cases
- [ ] Response DTOs used — no raw entities returned
- [ ] New routes protected with appropriate guards

---

*Last updated: 2026 — NestJS v10+ · Prisma v5+*