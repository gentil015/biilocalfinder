import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

// Mirrors the browser PushSubscription.toJSON() shape.
export class RegisterPushSubscriptionDto {
  @ApiProperty()
  @IsUrl({ require_tld: false })
  endpoint: string;

  @ApiProperty()
  @IsString()
  p256dh: string;

  @ApiProperty()
  @IsString()
  auth: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  userAgent?: string;
}
