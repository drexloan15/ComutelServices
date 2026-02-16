import { TicketPriority, TicketStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const ticketSortValues = [
  'CREATED_DESC',
  'CREATED_ASC',
  'PRIORITY_DESC',
  'PRIORITY_ASC',
] as const;

export type TicketSort = (typeof ticketSortValues)[number];
export const ticketSearchModes = ['CONTAINS', 'FTS'] as const;
export type TicketSearchMode = (typeof ticketSearchModes)[number];

export class TicketListQueryDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  text?: string;

  @IsOptional()
  @IsString()
  @IsIn(ticketSortValues)
  sort?: TicketSort;

  @IsOptional()
  @IsString()
  @IsIn(ticketSearchModes)
  searchMode?: TicketSearchMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
