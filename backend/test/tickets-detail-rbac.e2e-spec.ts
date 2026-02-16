import { ForbiddenException, INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { TicketsController } from '../src/tickets/tickets.controller';
import { TicketsService } from '../src/tickets/tickets.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { CurrentUser } from '../src/auth/types/current-user.type';

function assertAccess(ticketId: string, currentUser: CurrentUser) {
  if (ticketId === 'missing') {
    throw new NotFoundException(`Ticket ${ticketId} no existe`);
  }
  if (currentUser.role === UserRole.REQUESTER && ticketId === 'forbidden') {
    throw new ForbiddenException('No tienes permisos para acceder a este ticket');
  }
}

const ticketsServiceMock: Partial<TicketsService> = {
  findAll: async () => [],
  findOne: async (id: string, currentUser: CurrentUser) => {
    assertAccess(id, currentUser);
    return {
      id,
      code: 'INC-20260216-AAAABBBB',
      title: 'Ticket de prueba',
      status: 'OPEN',
      priority: 'MEDIUM',
      type: 'INCIDENT',
      impact: 'MEDIUM',
      urgency: 'MEDIUM',
      requester: {
        id: 'requester-1',
        fullName: 'Requester',
        email: 'requester@example.com',
      },
      assignee: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },
  findComments: async (id: string, currentUser: CurrentUser) => {
    assertAccess(id, currentUser);
    return [];
  },
  findStatusHistory: async (id: string, currentUser: CurrentUser) => {
    assertAccess(id, currentUser);
    return [];
  },
  addComment: async (id, dto, currentUser) => {
    assertAccess(id, currentUser);
    if (
      currentUser.role === UserRole.REQUESTER &&
      dto.type &&
      dto.type !== 'PUBLIC_NOTE'
    ) {
      throw new ForbiddenException(
        'No tienes permisos para ese tipo de comentario',
      );
    }

    return {
      id: 'comment-1',
      ticketId: id,
      body: dto.body,
      type: dto.type ?? 'PUBLIC_NOTE',
      createdAt: new Date().toISOString(),
      author: {
        id: currentUser.sub,
        fullName: 'Test User',
        email: currentUser.email,
      },
    };
  },
  update: async () => ({ success: true }),
  remove: async () => ({ success: true }),
  create: async () => ({ id: 'ticket-created' }),
};

describe('Tickets detail RBAC (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        RolesGuard,
        {
          provide: TicketsService,
          useValue: ticketsServiceMock,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => Record<string, unknown> };
        }) => {
          const requestRef = context.switchToHttp().getRequest();
          const role = String(
            requestRef.headers?.['x-user-role'] ?? UserRole.REQUESTER,
          ).toUpperCase() as UserRole;
          const sub = String(requestRef.headers?.['x-user-id'] ?? 'requester-1');
          requestRef.user = {
            sub,
            role,
            email: `${sub}@example.com`,
          };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/tickets/ok responde 200 cuando hay permiso', async () => {
    await request(app.getHttpServer())
      .get('/api/tickets/ok')
      .set('x-user-role', 'REQUESTER')
      .set('x-user-id', 'requester-1')
      .expect(200);
  });

  it('GET /api/tickets/forbidden responde 403 para requester sin acceso', async () => {
    await request(app.getHttpServer())
      .get('/api/tickets/forbidden')
      .set('x-user-role', 'REQUESTER')
      .set('x-user-id', 'requester-1')
      .expect(403);
  });

  it('GET /api/tickets/missing responde 404 para ticket inexistente', async () => {
    await request(app.getHttpServer())
      .get('/api/tickets/missing')
      .set('x-user-role', 'REQUESTER')
      .set('x-user-id', 'requester-1')
      .expect(404);
  });

  it('POST /api/tickets/ok/comments bloquea INTERNAL_NOTE para requester (403)', async () => {
    await request(app.getHttpServer())
      .post('/api/tickets/ok/comments')
      .set('x-user-role', 'REQUESTER')
      .set('x-user-id', 'requester-1')
      .send({
        body: 'Comentario',
        type: 'INTERNAL_NOTE',
      })
      .expect(403);
  });

  it('POST /api/tickets/ok/comments permite INTERNAL_NOTE para agent (201)', async () => {
    await request(app.getHttpServer())
      .post('/api/tickets/ok/comments')
      .set('x-user-role', 'AGENT')
      .set('x-user-id', 'agent-1')
      .send({
        body: 'Comentario interno',
        type: 'INTERNAL_NOTE',
      })
      .expect(201);
  });
});
