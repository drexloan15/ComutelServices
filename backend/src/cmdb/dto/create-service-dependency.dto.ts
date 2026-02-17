import { ServiceImpactLevel } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class CreateServiceDependencyDto {
  @IsString()
  fromServiceId!: string;

  @IsString()
  toServiceId!: string;

  @IsEnum(ServiceImpactLevel)
  impactLevel!: ServiceImpactLevel;
}
