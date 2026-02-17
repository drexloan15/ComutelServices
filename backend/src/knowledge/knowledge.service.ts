import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateKnowledgeArticleDto } from './dto/create-knowledge-article.dto';
import { CreateKnowledgeCommentDto } from './dto/create-knowledge-comment.dto';
import { KnowledgeListQueryDto } from './dto/knowledge-list-query.dto';
import { UpdateKnowledgeArticleDto } from './dto/update-knowledge-article.dto';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(currentUser: CurrentUser, query: KnowledgeListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 12;
    const skip = (page - 1) * pageSize;
    const sort = query.sort ?? 'LATEST';

    const normalizedTag = this.normalizeTag(query.tag);
    const normalizedSearch = query.search?.trim();
    const onlyPublished =
      currentUser.role === UserRole.REQUESTER || query.publishedOnly === true;

    const where: Prisma.KnowledgeArticleWhereInput = {
      ...(onlyPublished ? { isPublished: true } : {}),
      ...(normalizedTag ? { tags: { has: normalizedTag } } : {}),
      ...(normalizedSearch
        ? {
            OR: [
              { title: { contains: normalizedSearch, mode: 'insensitive' } },
              { excerpt: { contains: normalizedSearch, mode: 'insensitive' } },
              { body: { contains: normalizedSearch, mode: 'insensitive' } },
              { tags: { has: normalizedSearch.toLowerCase() } },
              {
                author: {
                  fullName: {
                    contains: normalizedSearch,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.knowledgeArticle.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
            },
          },
          _count: {
            select: {
              comments: true,
            },
          },
        },
        orderBy: { createdAt: sort === 'OLDEST' ? 'asc' : 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.knowledgeArticle.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOne(id: string, currentUser: CurrentUser) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
        _count: {
          select: {
            comments: true,
          },
        },
      },
    });

    if (!article) {
      throw new NotFoundException('Articulo no existe');
    }

    this.assertReadable(article, currentUser);
    return article;
  }

  async create(
    dto: CreateKnowledgeArticleDto,
    currentUser: CurrentUser,
    request?: { ip?: string; headers?: Record<string, unknown> },
  ) {
    const title = dto.title.trim();
    const slug = await this.buildUniqueSlug(title);

    const article = await this.prisma.knowledgeArticle.create({
      data: {
        slug,
        title,
        excerpt: this.toNullableString(dto.excerpt),
        body: dto.body.trim(),
        coverImageUrl: this.toNullableString(dto.coverImageUrl),
        galleryImageUrls: this.normalizeImageUrls(dto.galleryImageUrls),
        tags: this.normalizeTags(dto.tags),
        isPublished: dto.isPublished ?? false,
        publishedAt: dto.isPublished ? new Date() : null,
        authorId: currentUser.sub,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
        _count: {
          select: {
            comments: true,
          },
        },
      },
    });

    await this.auditService.log({
      actorUserId: currentUser.sub,
      action: AuditAction.KNOWLEDGE_ARTICLE_CREATED,
      resource: 'knowledge_article',
      resourceId: article.id,
      details: {
        slug: article.slug,
        title: article.title,
        isPublished: article.isPublished,
      },
      metadata: this.getMetadata(request),
    });

    return article;
  }

  async update(
    id: string,
    dto: UpdateKnowledgeArticleDto,
    currentUser: CurrentUser,
    request?: { ip?: string; headers?: Record<string, unknown> },
  ) {
    const existing = await this.prisma.knowledgeArticle.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Articulo no existe');
    }

    if (
      currentUser.role === UserRole.AGENT &&
      existing.authorId !== currentUser.sub
    ) {
      throw new ForbiddenException('No puedes editar articulos de otro autor');
    }

    const nextTitle = dto.title?.trim();
    const updateData: Prisma.KnowledgeArticleUpdateInput = {
      ...(nextTitle && {
        title: nextTitle,
        slug: await this.buildUniqueSlug(nextTitle, existing.id),
      }),
      ...(dto.excerpt !== undefined && {
        excerpt: this.toNullableString(dto.excerpt),
      }),
      ...(dto.body !== undefined && {
        body: dto.body.trim(),
      }),
      ...(dto.coverImageUrl !== undefined && {
        coverImageUrl: this.toNullableString(dto.coverImageUrl),
      }),
      ...(dto.galleryImageUrls !== undefined && {
        galleryImageUrls: this.normalizeImageUrls(dto.galleryImageUrls),
      }),
      ...(dto.tags !== undefined && {
        tags: this.normalizeTags(dto.tags),
      }),
      ...(dto.isPublished !== undefined && {
        isPublished: dto.isPublished,
        publishedAt: dto.isPublished
          ? (existing.publishedAt ?? new Date())
          : null,
      }),
    };

    const article = await this.prisma.knowledgeArticle.update({
      where: { id },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
        _count: {
          select: {
            comments: true,
          },
        },
      },
    });

    await this.auditService.log({
      actorUserId: currentUser.sub,
      action: AuditAction.KNOWLEDGE_ARTICLE_UPDATED,
      resource: 'knowledge_article',
      resourceId: article.id,
      details: {
        changedFields: Object.keys(dto),
        isPublished: article.isPublished,
      },
      metadata: this.getMetadata(request),
    });

    return article;
  }

  async findComments(articleId: string, currentUser: CurrentUser) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        isPublished: true,
      },
    });

    if (!article) {
      throw new NotFoundException('Articulo no existe');
    }

    this.assertReadable(article, currentUser);

    return this.prisma.knowledgeComment.findMany({
      where: { articleId },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addComment(
    articleId: string,
    dto: CreateKnowledgeCommentDto,
    currentUser: CurrentUser,
    request?: { ip?: string; headers?: Record<string, unknown> },
  ) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        isPublished: true,
      },
    });

    if (!article) {
      throw new NotFoundException('Articulo no existe');
    }

    this.assertReadable(article, currentUser);

    const comment = await this.prisma.knowledgeComment.create({
      data: {
        articleId,
        authorId: currentUser.sub,
        body: dto.body.trim(),
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
    });

    await this.auditService.log({
      actorUserId: currentUser.sub,
      action: AuditAction.KNOWLEDGE_COMMENT_CREATED,
      resource: 'knowledge_comment',
      resourceId: comment.id,
      details: {
        articleId,
      },
      metadata: this.getMetadata(request),
    });

    return comment;
  }

  private assertReadable(
    article: { isPublished: boolean },
    currentUser: CurrentUser,
  ) {
    if (currentUser.role === UserRole.REQUESTER && !article.isPublished) {
      throw new NotFoundException('Articulo no disponible');
    }
  }

  private async buildUniqueSlug(title: string, currentArticleId?: string) {
    const baseSlug = this.slugify(title);
    const candidates = [baseSlug, `${baseSlug}-${randomUUID().slice(0, 6)}`];

    for (const candidate of candidates) {
      const existing = await this.prisma.knowledgeArticle.findFirst({
        where: {
          slug: candidate,
          ...(currentArticleId ? { id: { not: currentArticleId } } : {}),
        },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }
    }

    return `${baseSlug}-${randomUUID().slice(0, 8)}`;
  }

  private slugify(input: string) {
    const normalized = input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    return normalized || `articulo-${randomUUID().slice(0, 8)}`;
  }

  private normalizeTags(tags?: string[]) {
    if (!tags) {
      return [];
    }

    return [
      ...new Set(tags.map((tag) => this.normalizeTag(tag)).filter(Boolean)),
    ];
  }

  private normalizeTag(tag?: string) {
    if (!tag) {
      return '';
    }

    return tag.trim().toLowerCase().replace(/\s+/g, '-');
  }

  private normalizeImageUrls(urls?: string[]) {
    if (!urls) {
      return [];
    }

    return [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
  }

  private toNullableString(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private getMetadata(request?: {
    ip?: string;
    headers?: Record<string, unknown>;
  }) {
    const rawUserAgent = request?.headers?.['user-agent'];
    return {
      ipAddress: request?.ip,
      userAgent: typeof rawUserAgent === 'string' ? rawUserAgent : undefined,
    };
  }
}
