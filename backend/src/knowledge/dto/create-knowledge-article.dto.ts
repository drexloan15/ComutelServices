import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ArrayMaxSize,
} from 'class-validator';

export class CreateKnowledgeArticleDto {
  @IsString()
  @MinLength(4)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  excerpt?: string;

  @IsString()
  @MinLength(20)
  @MaxLength(40000)
  body!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  coverImageUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsUrl({ require_protocol: true }, { each: true })
  galleryImageUrls?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
