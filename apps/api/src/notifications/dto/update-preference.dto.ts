import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum } from 'class-validator';
import { NotificationCategory } from '@prisma/client';

export class UpdatePreferenceDto {
  @ApiProperty({ enum: NotificationCategory })
  @IsEnum(NotificationCategory)
  category: NotificationCategory;

  @ApiProperty({ description: 'Show this category in the notification center at all' })
  @IsBoolean()
  inApp: boolean;

  @ApiProperty()
  @IsBoolean()
  push: boolean;

  @ApiProperty()
  @IsBoolean()
  email: boolean;
}
