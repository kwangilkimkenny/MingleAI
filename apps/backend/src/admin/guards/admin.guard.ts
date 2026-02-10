import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Default to admin and super_admin if no roles specified
    const roles = requiredRoles ?? ["admin", "super_admin"];

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException("관리자 권한이 필요합니다");
    }

    const hasRole = roles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException("관리자 권한이 필요합니다");
    }

    return true;
  }
}
