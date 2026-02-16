import { config as loadEnv } from 'dotenv';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import path from 'path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';

loadEnv({ path: path.resolve(__dirname, '../.env') });

describe('Tickets FTS Spanish relevance (e2e)', () => {
  type TicketListResponse = {
    total: number;
    data: Array<{ title: string }>;
  };

  let app: INestApplication<App>;
  let prisma: PrismaService;
  const requesterId = `fts-requester-${Date.now()}`;
  const requesterEmail = `${requesterId}@example.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => Record<string, unknown> };
        }) => {
          const requestRef = context.switchToHttp().getRequest();
          requestRef.user = {
            sub: String(requestRef.headers?.['x-user-id'] ?? requesterId),
            role: String(
              requestRef.headers?.['x-user-role'] ?? UserRole.REQUESTER,
            ).toUpperCase(),
            email: String(
              requestRef.headers?.['x-user-email'] ?? requesterEmail,
            ),
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

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.user.upsert({
      where: { email: requesterEmail },
      update: {
        fullName: 'Tester FTS',
        role: UserRole.REQUESTER,
      },
      create: {
        id: requesterId,
        email: requesterEmail,
        fullName: 'Tester FTS',
        role: UserRole.REQUESTER,
      },
    });

    await prisma.ticket.createMany({
      data: [
        {
          code: `FTS-ES-${Date.now()}-A`,
          title: 'Estamos gestionando incidencias de red',
          description: 'El equipo sigue gestionando casos masivos.',
          requesterId,
        },
        {
          code: `FTS-ES-${Date.now()}-B`,
          title: 'Solicitud de laptop para nuevo ingreso',
          description: 'Provision de hardware para colaborador.',
          requesterId,
        },
      ],
    });
  });

  afterEach(async () => {
    if (!prisma) {
      return;
    }
    await prisma.ticket.deleteMany({ where: { requesterId } });
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }
    await prisma.ticket.deleteMany({ where: { requesterId } });
    await prisma.user.deleteMany({ where: { id: requesterId } });
    if (app) {
      await app.close();
    }
  });

  it('FTS spanish encuentra variantes morfologicas (gestionar -> gestionando)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/tickets')
      .set('x-user-role', 'REQUESTER')
      .set('x-user-id', requesterId)
      .query({
        searchMode: 'FTS',
        text: 'gestionar',
        page: 1,
        pageSize: 20,
      })
      .expect(200);
    const body = response.body as TicketListResponse;

    expect(body.total).toBe(1);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toContain('gestionando');
  });

  it('CONTAINS no aplica stemming en la misma consulta', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/tickets')
      .set('x-user-role', 'REQUESTER')
      .set('x-user-id', requesterId)
      .query({
        searchMode: 'CONTAINS',
        text: 'gestionar',
        page: 1,
        pageSize: 20,
      })
      .expect(200);
    const body = response.body as TicketListResponse;

    expect(body.total).toBe(0);
    expect(body.data).toHaveLength(0);
  });
});
