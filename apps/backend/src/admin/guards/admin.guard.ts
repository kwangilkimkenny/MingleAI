import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { isPrivilegedRole } from "../../auth/role-policy";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException("관리자 권한이 필요합니다");
    }

    if (!isPrivilegedRole(user.role)) {
      throw new ForbiddenException("관리자 권한이 필요합니다");
    }

    return true;
  }
}
