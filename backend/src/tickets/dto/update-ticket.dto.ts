import { TicketImpact, TicketPriority, TicketStatus, TicketType, TicketUrgency } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsEnum(TicketType)
  type?: TicketType;

  @IsOptional()
  @IsEnum(TicketImpact)
  impact?: TicketImpact;

  @IsOptional()
  @IsEnum(TicketUrgency)
  urgency?: TicketUrgency;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  statusReason?: string;

  @IsOptional()
  @IsEmail()
  assigneeEmail?: string;
}
