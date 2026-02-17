import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateKnowledgeCommentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  body!: string;
}
