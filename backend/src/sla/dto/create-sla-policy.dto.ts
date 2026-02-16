import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateSlaPolicyDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  @Max(60 * 24 * 30)
  responseTimeMinutes!: number;

  @IsInt()
  @Min(1)
  @Max(60 * 24 * 60)
  resolutionTimeMinutes!: number;

  @IsOptional()
  @IsBoolean()
  businessHoursOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
