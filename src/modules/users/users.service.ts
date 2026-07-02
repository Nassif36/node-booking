import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto, AdminUpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return user;
  }

  async update(
    id: string,
    requesterId: string,
    requesterRole: Role,
    dto: UpdateUserDto | AdminUpdateUserDto,
  ) {
    // Regular users can only edit their own profile
    if (id !== requesterId && requesterRole !== Role.ADMIN) {
      throw new ForbiddenException('You can only update your own profile');
    }

    await this.findOne(id);

    // Strip sensitive fields for non-admins
    if (requesterRole !== Role.ADMIN) {
      const { role: _r, isActive: _a, ...safeDto } = dto as AdminUpdateUserDto;
      return this.prisma.user.update({
        where: { id },
        data: safeDto,
        select: USER_SELECT,
      });
    }

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: USER_SELECT,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: USER_SELECT,
    });
  }
}
