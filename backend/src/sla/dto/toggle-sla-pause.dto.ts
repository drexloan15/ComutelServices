import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ToggleSlaPauseDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
