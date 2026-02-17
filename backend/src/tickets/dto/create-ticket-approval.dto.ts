import { TicketApprovalType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTicketApprovalDto {
  @IsEnum(TicketApprovalType)
  type!: TicketApprovalType;

  @IsOptional()
  @IsString()
  approverId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
