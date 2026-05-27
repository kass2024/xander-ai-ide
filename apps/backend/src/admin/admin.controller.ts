import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('users')
  getUsers(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.getUsers(parseInt(page || '1', 10), parseInt(limit || '20', 10));
  }

  @Get('usage')
  getUsage(@Query('period') period?: string) {
    return this.adminService.getUsageStats(period);
  }

  @Get('subscriptions')
  getSubscriptions(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.getSubscriptions(parseInt(page || '1', 10), parseInt(limit || '20', 10));
  }
}
