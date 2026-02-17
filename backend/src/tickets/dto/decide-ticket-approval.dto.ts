import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TicketApprovalStatus } from '@prisma/client';

export class DecideTicketApprovalDto {
  @IsEnum(TicketApprovalStatus)
  decision!: TicketApprovalStatus;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
