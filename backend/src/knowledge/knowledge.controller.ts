import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { GetCurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUser } from '../auth/types/current-user.type';
import { CreateKnowledgeArticleDto } from './dto/create-knowledge-article.dto';
import { CreateKnowledgeCommentDto } from './dto/create-knowledge-comment.dto';
import { KnowledgeListQueryDto } from './dto/knowledge-list-query.dto';
import { UpdateKnowledgeArticleDto } from './dto/update-knowledge-article.dto';
import { KnowledgeService } from './knowledge.service';

@Controller('knowledge/articles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.REQUESTER)
  findAll(
    @GetCurrentUser() currentUser: CurrentUser,
    @Query() query: KnowledgeListQueryDto,
  ) {
    return this.knowledgeService.findAll(currentUser, query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.REQUESTER)
  findOne(@Param('id') id: string, @GetCurrentUser() currentUser: CurrentUser) {
    return this.knowledgeService.findOne(id, currentUser);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  create(
    @Body() dto: CreateKnowledgeArticleDto,
    @GetCurrentUser() currentUser: CurrentUser,
    @Req() req: Request,
  ) {
    return this.knowledgeService.create(dto, currentUser, req);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeArticleDto,
    @GetCurrentUser() currentUser: CurrentUser,
    @Req() req: Request,
  ) {
    return this.knowledgeService.update(id, dto, currentUser, req);
  }

  @Get(':id/comments')
  @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.REQUESTER)
  findComments(
    @Param('id') articleId: string,
    @GetCurrentUser() currentUser: CurrentUser,
  ) {
    return this.knowledgeService.findComments(articleId, currentUser);
  }

  @Post(':id/comments')
  @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.REQUESTER)
  addComment(
    @Param('id') articleId: string,
    @Body() dto: CreateKnowledgeCommentDto,
    @GetCurrentUser() currentUser: CurrentUser,
    @Req() req: Request,
  ) {
    return this.knowledgeService.addComment(articleId, dto, currentUser, req);
  }
}
