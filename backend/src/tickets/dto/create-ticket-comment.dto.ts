import { CommentType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTicketCommentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  body!: string;

  @IsOptional()
  @IsEnum(CommentType)
  type?: CommentType;
}
