import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApplyTicketMacroDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
