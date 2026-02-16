import {
  UnauthorizedException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { CurrentUser } from '../types/current-user.type';

export const GetCurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUser => {
    const request = context.switchToHttp().getRequest<{ user?: CurrentUser }>();
    if (!request.user) {
      throw new UnauthorizedException('No autorizado');
    }
    return request.user;
  },
);
