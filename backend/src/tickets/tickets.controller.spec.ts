import { UserRole } from '@prisma/client';
import { TicketsController } from './tickets.controller';

describe('TicketsController', () => {
  const ticketsServiceMock = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findComments: jest.fn(),
    addComment: jest.fn(),
    findStatusHistory: jest.fn(),
    findWorkspace: jest.fn(),
    addAttachment: jest.fn(),
    listMacros: jest.fn(),
    applyMacro: jest.fn(),
    createApproval: jest.fn(),
    decideApproval: jest.fn(),
  };

  const currentUser = {
    sub: 'user-1',
    email: 'user@example.com',
    role: UserRole.ADMIN,
  };

  const req = { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } };

  let controller: TicketsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new TicketsController(ticketsServiceMock as never);
  });

  it('delegates all endpoints to service', async () => {
    await controller.findAll(currentUser, { page: 1 });
    await controller.findOne('t-1', currentUser);
    await controller.create({ title: 'Ticket demo' } as never, currentUser);
    await controller.update(
      't-1',
      { status: 'IN_PROGRESS' } as never,
      currentUser,
      req as never,
    );
    await controller.remove('t-1', currentUser, req as never);
    await controller.findComments('t-1', currentUser);
    await controller.addComment('t-1', { body: 'hola' } as never, currentUser);
    await controller.findStatusHistory('t-1', currentUser);
    await controller.findWorkspace('t-1', currentUser);
    await controller.addAttachment(
      't-1',
      { fileName: 'evidence.txt' } as never,
      currentUser,
      req as never,
    );
    await controller.listMacros(currentUser);
    await controller.applyMacro(
      't-1',
      'm-1',
      { reason: 'auto' } as never,
      currentUser,
    );
    await controller.createApproval(
      't-1',
      { type: 'MANAGER' } as never,
      currentUser,
    );
    await controller.decideApproval(
      't-1',
      'a-1',
      { decision: 'APPROVED' } as never,
      currentUser,
    );

    expect(ticketsServiceMock.findAll).toHaveBeenCalledWith(currentUser, {
      page: 1,
    });
    expect(ticketsServiceMock.findOne).toHaveBeenCalledWith('t-1', currentUser);
    expect(ticketsServiceMock.create).toHaveBeenCalled();
    expect(ticketsServiceMock.update).toHaveBeenCalledWith(
      't-1',
      { status: 'IN_PROGRESS' },
      currentUser,
      req,
    );
    expect(ticketsServiceMock.remove).toHaveBeenCalledWith(
      't-1',
      currentUser,
      req,
    );
    expect(ticketsServiceMock.findComments).toHaveBeenCalledWith(
      't-1',
      currentUser,
    );
    expect(ticketsServiceMock.addComment).toHaveBeenCalledWith(
      't-1',
      { body: 'hola' },
      currentUser,
    );
    expect(ticketsServiceMock.findStatusHistory).toHaveBeenCalledWith(
      't-1',
      currentUser,
    );
    expect(ticketsServiceMock.findWorkspace).toHaveBeenCalledWith(
      't-1',
      currentUser,
    );
    expect(ticketsServiceMock.addAttachment).toHaveBeenCalledWith(
      't-1',
      { fileName: 'evidence.txt' },
      currentUser,
      req,
    );
    expect(ticketsServiceMock.listMacros).toHaveBeenCalledWith(currentUser);
    expect(ticketsServiceMock.applyMacro).toHaveBeenCalledWith(
      't-1',
      'm-1',
      { reason: 'auto' },
      currentUser,
    );
    expect(ticketsServiceMock.createApproval).toHaveBeenCalledWith(
      't-1',
      { type: 'MANAGER' },
      currentUser,
    );
    expect(ticketsServiceMock.decideApproval).toHaveBeenCalledWith(
      't-1',
      'a-1',
      { decision: 'APPROVED' },
      currentUser,
    );
  });
});
