import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateBusinessServiceDto {
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(140)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @IsOptional()
  @IsString()
  ownerGroupId?: string;

  @IsOptional()
  @IsBoolean()
  isCritical?: boolean;
}
