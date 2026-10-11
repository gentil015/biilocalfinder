import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { WorkspaceMemberRole } from '@prisma/client';

const ASSIGNABLE_ROLES: WorkspaceMemberRole[] = ['MANAGER', 'MEMBER'];

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ASSIGNABLE_ROLES, description: 'Ownership transfers are not done here' })
  @IsIn(ASSIGNABLE_ROLES)
  role!: WorkspaceMemberRole;
}
