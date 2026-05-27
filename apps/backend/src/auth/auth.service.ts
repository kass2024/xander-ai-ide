import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';

export { LoginDto, RegisterDto };

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email.trim().toLowerCase());
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async loginFromUser(user: {
    id: string;
    email: string;
    fullName?: string | null;
    role: string;
    avatar?: string | null;
  }) {
    await this.usersService.updateLastLogin(user.id);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatar: user.avatar,
      },
    };
  }

  /** @deprecated Use LocalAuthGuard + loginFromUser */
  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    return this.loginFromUser(user);
  }

  async register(registerDto: RegisterDto) {
    registerDto.email = registerDto.email.trim().toLowerCase();
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create user
    const user = await this.usersService.create({
      email: registerDto.email,
      password: hashedPassword,
      fullName: registerDto.fullName,
    });

    // Generate JWT token
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatar: user.avatar,
      },
    };
  }

  async refreshToken(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async getProfile(userId: string) {
    const [user, subscription] = await Promise.all([
      this.usersService.findOne(userId),
      this.usersService.getUserSubscription(userId),
    ]);

    const planSlug =
      (subscription as { plan?: { id?: string; slug?: string } })?.plan?.id ||
      (subscription as { plan?: { slug?: string } })?.plan?.slug ||
      'free';

    return {
      ...user,
      plan: planSlug,
      subscription,
    };
  }
}
