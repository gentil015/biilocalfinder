import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssignResourceDto {
  @ApiPropertyOptional({ description: 'Active workspace membership to assign, or null to unassign', nullable: true })
  @IsOptional()
  @IsUUID()
  membershipId?: string | null;
}

export class TransferOwnershipDto {
  @ApiProperty({ description: 'Active workspace membership that will become the owner' })
  @IsUUID()
  membershipId!: string;
}
