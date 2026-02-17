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
import { AddTicketAttachmentDto } from './dto/add-ticket-attachment.dto';
import { ApplyTicketMacroDto } from './dto/apply-ticket-macro.dto';
import { CreateTicketApprovalDto } from './dto/create-ticket-approval.dto';
import { DecideTicketApprovalDto } from './dto/decide-ticket-approval.dto';
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
  create(
    @Body() dto: CreateTicketDto,
    @GetCurrentUser() currentUser: CurrentUser,
  ) {
    return this.ticketsService.create(dto, currentUser);
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
  findComments(
    @Param('id') id: string,
    @GetCurrentUser() currentUser: CurrentUser,
  ) {
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
  findStatusHistory(
    @Param('id') id: string,
    @GetCurrentUser() currentUser: CurrentUser,
  ) {
    return this.ticketsService.findStatusHistory(id, currentUser);
  }

  @Get(':id/workspace')
  @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.REQUESTER)
  findWorkspace(
    @Param('id') id: string,
    @GetCurrentUser() currentUser: CurrentUser,
  ) {
    return this.ticketsService.findWorkspace(id, currentUser);
  }

  @Post(':id/attachments')
  @Roles(UserRole.ADMIN, UserRole.AGENT, UserRole.REQUESTER)
  addAttachment(
    @Param('id') id: string,
    @Body() dto: AddTicketAttachmentDto,
    @GetCurrentUser() currentUser: CurrentUser,
    @Req() req: Request,
  ) {
    return this.ticketsService.addAttachment(id, dto, currentUser, req);
  }

  @Get('automation/macros')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  listMacros(@GetCurrentUser() currentUser: CurrentUser) {
    return this.ticketsService.listMacros(currentUser);
  }

  @Post(':id/macros/:macroId/apply')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  applyMacro(
    @Param('id') id: string,
    @Param('macroId') macroId: string,
    @Body() dto: ApplyTicketMacroDto,
    @GetCurrentUser() currentUser: CurrentUser,
  ) {
    return this.ticketsService.applyMacro(id, macroId, dto, currentUser);
  }

  @Post(':id/approvals')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  createApproval(
    @Param('id') id: string,
    @Body() dto: CreateTicketApprovalDto,
    @GetCurrentUser() currentUser: CurrentUser,
  ) {
    return this.ticketsService.createApproval(id, dto, currentUser);
  }

  @Patch(':id/approvals/:approvalId')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  decideApproval(
    @Param('id') id: string,
    @Param('approvalId') approvalId: string,
    @Body() dto: DecideTicketApprovalDto,
    @GetCurrentUser() currentUser: CurrentUser,
  ) {
    return this.ticketsService.decideApproval(id, approvalId, dto, currentUser);
  }
}
