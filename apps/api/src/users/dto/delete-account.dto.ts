import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({ description: 'Current password, used to confirm the irreversible action' })
  @IsString()
  @MinLength(1)
  password!: string;
}
