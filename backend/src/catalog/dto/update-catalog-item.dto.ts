import { TicketApprovalType, TicketPriority, TicketType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateCatalogItemDto {
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
}
