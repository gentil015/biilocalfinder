import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateRequestPrivacyDto {
  @ApiProperty({
    description:
      'True opens the direct request to other matching providers so they can also submit competing quotes; false keeps it private to the pinned provider.',
  })
  @IsBoolean()
  isPublic: boolean;
}