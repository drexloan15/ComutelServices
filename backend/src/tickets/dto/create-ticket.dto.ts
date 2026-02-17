import {
  TicketImpact,
  TicketPriority,
  TicketType,
  TicketUrgency,
} from '@prisma/client';
import {
  IsObject,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @MinLength(5)
  @MaxLength(120)
  title!: string;

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

  @IsEmail()
  requesterEmail!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  requesterName!: string;

  @IsOptional()
  @IsEmail()
  assigneeEmail?: string;

  @IsOptional()
  @IsString()
  catalogItemId?: string;

  @IsOptional()
  @IsObject()
  catalogFormPayload?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  impactedServiceId?: string;
}
