import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { GetCurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUser } from '../auth/types/current-user.type';
import { CatalogService } from './catalog.service';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { CreateWorkflowRuleDto } from './dto/create-workflow-rule.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';

@Controller('catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('items')
  @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.REQUESTER)
  findItems(@GetCurrentUser() currentUser: CurrentUser) {
    return this.catalogService.findItems(currentUser);
  }

  @Get('items/:id')
  @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.REQUESTER)
  findItemById(
    @Param('id') id: string,
    @GetCurrentUser() currentUser: CurrentUser,
  ) {
    return this.catalogService.findItemById(id, currentUser);
  }

  @Post('items')
  @Roles(UserRole.ADMIN)
  createItem(
    @Body() dto: CreateCatalogItemDto,
    @GetCurrentUser() currentUser: CurrentUser,
  ) {
    return this.catalogService.createItem(dto, currentUser);
  }

  @Patch('items/:id')
  @Roles(UserRole.ADMIN)
  updateItem(@Param('id') id: string, @Body() dto: UpdateCatalogItemDto) {
    return this.catalogService.updateItem(id, dto);
  }

  @Get('workflow-rules')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  findWorkflowRules() {
    return this.catalogService.findWorkflowRules();
  }

  @Post('workflow-rules')
  @Roles(UserRole.ADMIN)
  createWorkflowRule(@Body() dto: CreateWorkflowRuleDto) {
    return this.catalogService.createWorkflowRule(dto);
  }
}
