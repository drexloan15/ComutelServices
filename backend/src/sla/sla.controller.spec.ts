import { UserRole } from '@prisma/client';
import { SlaController } from './sla.controller';

describe('SlaController', () => {
  const slaServiceMock = {
    findPolicies: jest.fn(),
    createPolicy: jest.fn(),
    updatePolicy: jest.fn(),
    findTracking: jest.fn(),
    runEngineByCurrentUser: jest.fn(),
    findCalendars: jest.fn(),
    createCalendar: jest.fn(),
    pauseTracking: jest.fn(),
    resumeTracking: jest.fn(),
    getBreachPredictions: jest.fn(),
  };

  const currentUser = {
    sub: 'agent-1',
    email: 'agent@example.com',
    role: UserRole.AGENT,
  };

  let controller: SlaController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new SlaController(slaServiceMock as never);
  });

  it('delegates SLA endpoints to service', async () => {
    await controller.findPolicies();
    await controller.createPolicy({ name: '24x7' } as never);
    await controller.updatePolicy('p-1', { isActive: true } as never);
    await controller.findTracking({ page: 1 } as never);
    await controller.runEngine(currentUser);
    await controller.findCalendars();
    await controller.createCalendar({ name: 'L-V' } as never);
    await controller.pauseTracking(
      't-1',
      { reason: 'cliente espera' } as never,
      currentUser,
    );
    await controller.resumeTracking(
      't-1',
      { reason: 'cliente respondio' } as never,
      currentUser,
    );
    await controller.getPredictions({ windowHours: 24 } as never);

    expect(slaServiceMock.findPolicies).toHaveBeenCalled();
    expect(slaServiceMock.createPolicy).toHaveBeenCalledWith({ name: '24x7' });
    expect(slaServiceMock.updatePolicy).toHaveBeenCalledWith('p-1', {
      isActive: true,
    });
    expect(slaServiceMock.findTracking).toHaveBeenCalledWith({ page: 1 });
    expect(slaServiceMock.runEngineByCurrentUser).toHaveBeenCalledWith(
      currentUser,
    );
    expect(slaServiceMock.findCalendars).toHaveBeenCalled();
    expect(slaServiceMock.createCalendar).toHaveBeenCalledWith({ name: 'L-V' });
    expect(slaServiceMock.pauseTracking).toHaveBeenCalledWith(
      't-1',
      currentUser,
      'cliente espera',
    );
    expect(slaServiceMock.resumeTracking).toHaveBeenCalledWith(
      't-1',
      currentUser,
      'cliente respondio',
    );
    expect(slaServiceMock.getBreachPredictions).toHaveBeenCalledWith({
      windowHours: 24,
    });
  });
});
