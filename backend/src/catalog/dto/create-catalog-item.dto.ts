import {
  CatalogFieldType,
  TicketApprovalType,
  TicketPriority,
  TicketType,
} from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CatalogFieldInputDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  key!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;

  @IsEnum(CatalogFieldType)
  fieldType!: CatalogFieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  order?: number;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  placeholder?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  helpText?: string;

  @IsOptional()
  @IsObject()
  optionsJson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  showWhenFieldKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  showWhenValue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  validationRegex?: string;
}

export class CreateCatalogItemDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  key!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(140)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @IsOptional()
  @IsEnum(TicketType)
  ticketType?: TicketType;

  @IsOptional()
  @IsEnum(TicketPriority)
  defaultPriority?: TicketPriority;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @IsOptional()
  @IsEnum(TicketApprovalType)
  approvalType?: TicketApprovalType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogFieldInputDto)
  fields?: CatalogFieldInputDto[];
}
