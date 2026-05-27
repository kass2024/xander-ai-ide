import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { UsersService, UpdateUserDto } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req) {
    return this.usersService.findOne(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/settings')
  getSettings(@Request() req) {
    return this.usersService.getUserSettings(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/subscription')
  getSubscription(@Request() req) {
    return this.usersService.getUserSubscription(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/usage')
  getUsage(@Request() req) {
    return this.usersService.getUserUsageStats(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/analytics')
  getAnalytics(@Request() req, @Query('period') period?: string) {
    return this.usersService.getAnalytics(req.user.id, period);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/contributions')
  getContributions(@Request() req, @Query('period') period?: string) {
    return this.usersService.getContributions(req.user.id, period);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/notifications')
  getNotifications(@Request() req) {
    return this.usersService.getNotifications(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/notifications/:id/read')
  markNotificationAsRead(@Request() req, @Param('id') id: string) {
    return this.usersService.markNotificationAsRead(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(req.user.id, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/settings')
  updateSettings(@Request() req, @Body() settings: any) {
    return this.usersService.updateUserSettings(req.user.id, settings);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
