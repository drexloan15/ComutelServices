import { UserRole } from '@prisma/client';

export type CurrentUser = {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
};
