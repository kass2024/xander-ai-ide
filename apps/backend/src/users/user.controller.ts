import { Controller, Get, Put, UseGuards, Request, Body, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  async getProfile(@Request() req) {
    return this.userService.getProfile(req.user.id);
  }

  @Put('profile')
  async updateProfile(@Request() req, @Body() updateProfileDto: any) {
    return this.userService.updateProfile(req.user.id, updateProfileDto);
  }

  @Get('analytics')
  async getAnalytics(@Request() req, @Query('period') period?: string) {
    return this.userService.getAnalytics(req.user.id, period);
  }

  @Get('contributions')
  async getContributions(@Request() req, @Query('period') period?: string) {
    return this.userService.getContributions(req.user.id, period);
  }
}
