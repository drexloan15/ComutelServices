import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AddTicketAttachmentDto {
  @IsString()
  @MaxLength(180)
  fileName!: string;

  @IsString()
  @MaxLength(500)
  storageUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500000000)
  sizeBytes?: number;
}
