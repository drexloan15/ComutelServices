import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ServiceLinkType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { CreateBusinessServiceDto } from './dto/create-business-service.dto';
import { CreateServiceDependencyDto } from './dto/create-service-dependency.dto';
import { UpdateBusinessServiceDto } from './dto/update-business-service.dto';

@Injectable()
export class CmdbService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findServices() {
    return this.prisma.businessService.findMany({
      include: {
        ownerGroup: {
          select: { id: true, code: true, name: true },
        },
        assets: {
          include: {
            asset: true,
          },
        },
        dependenciesFrom: {
          include: {
            toService: {
              select: { id: true, code: true, name: true, isCritical: true },
            },
          },
        },
        dependenciesTo: {
          include: {
            fromService: {
              select: { id: true, code: true, name: true, isCritical: true },
            },
          },
        },
      },
      orderBy: [{ isCritical: 'desc' }, { name: 'asc' }],
    });
  }

  createService(dto: CreateBusinessServiceDto) {
    return this.prisma.businessService.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        ownerGroupId: dto.ownerGroupId,
        isCritical: dto.isCritical ?? false,
      },
    });
  }

  async updateService(id: string, dto: UpdateBusinessServiceDto) {
    const existing = await this.prisma.businessService.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Servicio CMDB no encontrado');
    }

    return this.prisma.businessService.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        ownerGroupId: dto.ownerGroupId,
        isCritical: dto.isCritical,
      },
    });
  }

  findAssets() {
    return this.prisma.asset.findMany({
      include: {
        owner: {
          select: { id: true, fullName: true, email: true },
        },
        serviceLinks: {
          include: {
            service: {
              select: { id: true, code: true, name: true, isCritical: true },
            },
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 300,
    });
  }

  createAsset(dto: CreateAssetDto) {
    return this.prisma.asset.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        status: dto.status,
        serialNumber: dto.serialNumber,
        ownerId: dto.ownerId,
      },
    });
  }

  async linkAssetToService(
    serviceId: string,
    assetId: string,
    currentUser: CurrentUser,
    linkType: ServiceLinkType = ServiceLinkType.SUPPORTING,
  ) {
    const service = await this.prisma.businessService.findUnique({
      where: { id: serviceId },
      select: { id: true, code: true, name: true },
    });
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, code: true, name: true },
    });

    if (!service || !asset) {
      throw new NotFoundException('Servicio o asset no encontrado');
    }

    const link = await this.prisma.assetServiceLink.upsert({
      where: {
        assetId_serviceId: {
          assetId,
          serviceId,
        },
      },
      create: {
        assetId,
        serviceId,
        linkType,
      },
      update: {
        linkType,
      },
    });

    await this.auditService.log({
      actorUserId: currentUser.sub,
      action: AuditAction.CMDB_SERVICE_LINKED,
      resource: 'cmdb_asset_service_link',
      resourceId: `${assetId}:${serviceId}`,
      details: {
        service: service.code,
        asset: asset.code,
        linkType,
      },
    });

    return link;
  }

  createServiceDependency(dto: CreateServiceDependencyDto) {
    return this.prisma.serviceDependency.upsert({
      where: {
        fromServiceId_toServiceId: {
          fromServiceId: dto.fromServiceId,
          toServiceId: dto.toServiceId,
        },
      },
      create: {
        fromServiceId: dto.fromServiceId,
        toServiceId: dto.toServiceId,
        impactLevel: dto.impactLevel,
      },
      update: {
        impactLevel: dto.impactLevel,
      },
    });
  }

  async getTicketImpact(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        impactedService: {
          include: {
            dependenciesFrom: {
              include: {
                toService: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    isCritical: true,
                  },
                },
              },
            },
            dependenciesTo: {
              include: {
                fromService: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    isCritical: true,
                  },
                },
              },
            },
          },
        },
        assets: {
          include: {
            asset: {
              include: {
                serviceLinks: {
                  include: {
                    service: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                        isCritical: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado');
    }

    const affectedServicesByAsset = ticket.assets.flatMap((ticketAsset) =>
      ticketAsset.asset.serviceLinks.map((link) => ({
        serviceId: link.serviceId,
        service: link.service,
        viaAsset: {
          id: ticketAsset.asset.id,
          code: ticketAsset.asset.code,
          name: ticketAsset.asset.name,
        },
        linkType: link.linkType,
      })),
    );

    return {
      ticketId: ticket.id,
      ticketCode: ticket.code,
      impactedService: ticket.impactedService,
      affectedServicesByAsset,
    };
  }
}
