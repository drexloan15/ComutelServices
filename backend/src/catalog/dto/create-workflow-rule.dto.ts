import { TicketPriority, TicketStatus, TicketType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateWorkflowRuleDto {
  @IsString()
  @MinLength(4)
  @MaxLength(140)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @IsOptional()
  @IsString()
  catalogItemId?: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priorityEquals?: TicketPriority;

  @IsOptional()
  @IsEnum(TicketType)
  typeEquals?: TicketType;

  @IsOptional()
  @IsEnum(TicketStatus)
  onStatus?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority)
  actionSetPriority?: TicketPriority;

  @IsOptional()
  @IsString()
  actionAssignGroupId?: string;

  @IsOptional()
  @IsString()
  actionAssignUserId?: string;

  @IsOptional()
  @IsString()
  actionSetSlaPolicyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  actionAddComment?: string;

  @IsOptional()
  @IsBoolean()
  actionNotifyAdmins?: boolean;

  @IsOptional()
  @IsBoolean()
  actionNotifyAssignee?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
