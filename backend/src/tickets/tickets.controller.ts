import {
  Body,
  Controller,
  Delete,
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
import { CreateTicketCommentDto } from './dto/create-ticket-comment.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketListQueryDto } from './dto/ticket-list-query.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketsService } from './tickets.service';

@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.REQUESTER)
  findAll(
    @GetCurrentUser() currentUser: CurrentUser,
    @Query() query: TicketListQueryDto,
  ) {
    return this.ticketsService.findAll(currentUser, query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.REQUESTER)
  findOne(@Param('id') id: string, @GetCurrentUser() currentUser: CurrentUser) {
    return this.ticketsService.findOne(id, currentUser);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.REQUESTER)
  create(@Body() dto: CreateTicketDto) {
    return this.ticketsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
    @GetCurrentUser() currentUser: CurrentUser,
    @Req() req: Request,
  ) {
    return this.ticketsService.update(id, dto, currentUser, req);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  remove(
    @Param('id') id: string,
    @GetCurrentUser() currentUser: CurrentUser,
    @Req() req: Request,
  ) {
    return this.ticketsService.remove(id, currentUser, req);
  }

  @Get(':id/comments')
  @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.REQUESTER)
  findComments(@Param('id') id: string, @GetCurrentUser() currentUser: CurrentUser) {
    return this.ticketsService.findComments(id, currentUser);
  }

  @Post(':id/comments')
  @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.REQUESTER)
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateTicketCommentDto,
    @GetCurrentUser() currentUser: CurrentUser,
  ) {
    return this.ticketsService.addComment(id, dto, currentUser);
  }

  @Get(':id/status-history')
  @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.REQUESTER)
  findStatusHistory(@Param('id') id: string, @GetCurrentUser() currentUser: CurrentUser) {
    return this.ticketsService.findStatusHistory(id, currentUser);
  }
}
