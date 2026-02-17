import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  CatalogFieldType,
  Prisma,
  TicketApprovalType,
  UserRole,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { CreateWorkflowRuleDto } from './dto/create-workflow-rule.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';

type CatalogPayload = Record<string, unknown>;

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findItems(currentUser: CurrentUser) {
    return this.prisma.serviceCatalogItem.findMany({
      where:
        currentUser.role === UserRole.REQUESTER
          ? { isActive: true }
          : undefined,
      include: {
        fields: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async findItemById(id: string, currentUser: CurrentUser) {
    const item = await this.prisma.serviceCatalogItem.findUnique({
      where: { id },
      include: {
        fields: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!item || (currentUser.role === UserRole.REQUESTER && !item.isActive)) {
      throw new NotFoundException('Catalog item no encontrado');
    }

    return item;
  }

  async createItem(dto: CreateCatalogItemDto, currentUser: CurrentUser) {
    const created = await this.prisma.serviceCatalogItem.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        ticketType: dto.ticketType,
        defaultPriority: dto.defaultPriority,
        requiresApproval: dto.requiresApproval ?? false,
        approvalType: dto.approvalType,
        isActive: dto.isActive ?? true,
        fields: dto.fields?.length
          ? {
              create: dto.fields.map((field, index) => ({
                key: field.key,
                label: field.label,
                fieldType: field.fieldType,
                required: field.required ?? false,
                order: field.order ?? index,
                placeholder: field.placeholder,
                helpText: field.helpText,
                optionsJson: this.toNullableJsonInput(
                  field.optionsJson as Prisma.InputJsonValue | null | undefined,
                ),
                showWhenFieldKey: field.showWhenFieldKey,
                showWhenValue: field.showWhenValue,
                validationRegex: field.validationRegex,
              })),
            }
          : undefined,
      },
      include: {
        fields: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    await this.auditService.log({
      actorUserId: currentUser.sub,
      action: AuditAction.CATALOG_ITEM_CREATED,
      resource: 'service_catalog_item',
      resourceId: created.id,
      details: {
        key: created.key,
        requiresApproval: created.requiresApproval,
        fields: created.fields.length,
      },
    });

    return created;
  }

  async updateItem(id: string, dto: UpdateCatalogItemDto) {
    const existing = await this.prisma.serviceCatalogItem.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Catalog item no encontrado');
    }

    return this.prisma.serviceCatalogItem.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        ticketType: dto.ticketType,
        defaultPriority: dto.defaultPriority,
        requiresApproval: dto.requiresApproval,
        approvalType: dto.approvalType,
        isActive: dto.isActive,
      },
      include: {
        fields: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
  }

  findWorkflowRules() {
    return this.prisma.workflowRule.findMany({
      include: {
        catalogItem: {
          select: { id: true, key: true, name: true },
        },
        actionAssignGroup: {
          select: { id: true, code: true, name: true },
        },
        actionAssignUser: {
          select: { id: true, email: true, fullName: true },
        },
        actionSetSlaPolicy: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
  }

  createWorkflowRule(dto: CreateWorkflowRuleDto) {
    return this.prisma.workflowRule.create({
      data: {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive ?? true,
        catalogItemId: dto.catalogItemId,
        priorityEquals: dto.priorityEquals,
        typeEquals: dto.typeEquals,
        onStatus: dto.onStatus,
        actionSetPriority: dto.actionSetPriority,
        actionAssignGroupId: dto.actionAssignGroupId,
        actionAssignUserId: dto.actionAssignUserId,
        actionSetSlaPolicyId: dto.actionSetSlaPolicyId,
        actionAddComment: dto.actionAddComment,
        actionNotifyAdmins: dto.actionNotifyAdmins ?? false,
        actionNotifyAssignee: dto.actionNotifyAssignee ?? false,
      },
    });
  }

  async resolveCatalogForTicketCreation(
    catalogItemId: string | undefined,
    payload: unknown,
    currentUser: CurrentUser,
  ) {
    if (!catalogItemId) {
      return null;
    }

    const item = await this.prisma.serviceCatalogItem.findUnique({
      where: { id: catalogItemId },
      include: {
        fields: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!item || (!item.isActive && currentUser.role === UserRole.REQUESTER)) {
      throw new NotFoundException('Catalog item no disponible');
    }

    const normalizedPayload = this.validateCatalogPayload(item.fields, payload);

    return {
      catalogItem: item,
      normalizedPayload,
      requiresApproval: item.requiresApproval,
      approvalType: item.approvalType ?? TicketApprovalType.MANAGER,
    };
  }

  private validateCatalogPayload(
    fields: Array<{
      key: string;
      label: string;
      fieldType: CatalogFieldType;
      required: boolean;
      showWhenFieldKey: string | null;
      showWhenValue: string | null;
      validationRegex: string | null;
      optionsJson: Prisma.JsonValue | null;
    }>,
    payload: unknown,
  ): Prisma.InputJsonValue {
    const data = this.ensurePayloadObject(payload);

    for (const field of fields) {
      const visible = this.isFieldVisible(field, data);
      const rawValue = data[field.key];
      const isEmpty =
        rawValue === undefined || rawValue === null || rawValue === '';

      if (field.required && visible && isEmpty) {
        throw new BadRequestException(`Campo requerido: ${field.label}`);
      }

      if (!visible || isEmpty) {
        continue;
      }

      const normalized = this.validateFieldValue(field, rawValue);
      data[field.key] = normalized;
    }

    return data as Prisma.InputJsonValue;
  }

  private ensurePayloadObject(payload: unknown): CatalogPayload {
    if (payload === undefined || payload === null) {
      return {};
    }
    if (typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('catalogFormPayload debe ser un objeto');
    }
    return { ...(payload as CatalogPayload) };
  }

  private isFieldVisible(
    field: { showWhenFieldKey: string | null; showWhenValue: string | null },
    payload: CatalogPayload,
  ) {
    if (!field.showWhenFieldKey || field.showWhenValue === null) {
      return true;
    }

    const dependentValue = payload[field.showWhenFieldKey];
    let normalizedDependent = '';
    if (typeof dependentValue === 'string') {
      normalizedDependent = dependentValue;
    } else if (typeof dependentValue === 'number') {
      normalizedDependent = dependentValue.toString();
    } else if (typeof dependentValue === 'boolean') {
      normalizedDependent = dependentValue ? 'true' : 'false';
    }

    return normalizedDependent === String(field.showWhenValue);
  }

  private validateFieldValue(
    field: {
      key: string;
      label: string;
      fieldType: CatalogFieldType;
      validationRegex: string | null;
      optionsJson: Prisma.JsonValue | null;
    },
    value: unknown,
  ) {
    switch (field.fieldType) {
      case CatalogFieldType.TEXT:
      case CatalogFieldType.TEXTAREA:
      case CatalogFieldType.SELECT:
      case CatalogFieldType.EMAIL:
      case CatalogFieldType.USER: {
        if (typeof value !== 'string') {
          throw new BadRequestException(`Campo invalido: ${field.label}`);
        }
        break;
      }
      case CatalogFieldType.NUMBER: {
        const parsed =
          typeof value === 'number' ? value : Number(String(value).trim());
        if (!Number.isFinite(parsed)) {
          throw new BadRequestException(`Campo invalido: ${field.label}`);
        }
        value = parsed;
        break;
      }
      case CatalogFieldType.BOOLEAN: {
        if (typeof value === 'boolean') {
          break;
        }
        if (value === 'true') {
          value = true;
          break;
        }
        if (value === 'false') {
          value = false;
          break;
        }
        throw new BadRequestException(`Campo invalido: ${field.label}`);
      }
      case CatalogFieldType.DATE: {
        const parsed = new Date(String(value));
        if (Number.isNaN(parsed.getTime())) {
          throw new BadRequestException(`Campo invalido: ${field.label}`);
        }
        value = parsed.toISOString();
        break;
      }
      default:
        throw new BadRequestException(
          `Tipo de campo no soportado: ${field.key}`,
        );
    }

    if (field.validationRegex && typeof value === 'string') {
      const regex = new RegExp(field.validationRegex);
      if (!regex.test(value)) {
        throw new BadRequestException(`Validacion fallida en: ${field.label}`);
      }
    }

    if (field.fieldType === CatalogFieldType.SELECT && field.optionsJson) {
      const options = this.extractSelectOptions(field.optionsJson);
      if (options.length > 0 && !options.includes(String(value))) {
        throw new BadRequestException(`Opcion invalida en: ${field.label}`);
      }
    }

    return value;
  }

  private extractSelectOptions(jsonValue: Prisma.JsonValue): string[] {
    if (
      !jsonValue ||
      typeof jsonValue !== 'object' ||
      Array.isArray(jsonValue)
    ) {
      return [];
    }

    const options = (jsonValue as Record<string, unknown>).options;
    if (!Array.isArray(options)) {
      return [];
    }

    return options
      .filter((item) => typeof item === 'string')
      .map((item) => String(item));
  }

  private toNullableJsonInput(metadata?: Prisma.InputJsonValue | null) {
    if (metadata === null) {
      return Prisma.JsonNull;
    }
    return metadata;
  }
}
