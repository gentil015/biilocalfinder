import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn } from 'class-validator';
import { WorkspaceMemberRole } from '@prisma/client';

const INVITABLE_ROLES: WorkspaceMemberRole[] = ['MANAGER', 'MEMBER'];

export class InviteMemberDto {
  @ApiProperty({ description: 'Email of the existing BII LocalFinder account to invite' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: INVITABLE_ROLES, description: 'OWNER cannot be granted via invite' })
  @IsIn(INVITABLE_ROLES)
  role!: WorkspaceMemberRole;
}
