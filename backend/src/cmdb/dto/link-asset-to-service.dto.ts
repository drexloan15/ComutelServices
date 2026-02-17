import { ServiceLinkType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class LinkAssetToServiceDto {
  @IsOptional()
  @IsEnum(ServiceLinkType)
  linkType?: ServiceLinkType;
}
