import { Module } from '@nestjs/common';
import { PrismaService } from '@prismaService';
import { BusinessInfoController } from './business-info-controller';
import { BusinessInfoService } from './business-info-service';

@Module({
  controllers: [BusinessInfoController],
  providers: [BusinessInfoService, PrismaService],
})
export class BusinessInfoModule {}
