import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { registerDecorator, ValidationOptions } from 'class-validator';

function IsSafePushEndpoint(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSafePushEndpoint',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;
          try {
            const url = new URL(value);
            if (url.protocol !== 'https:') return false;
            const host = url.hostname.toLowerCase();
            if (
              host === 'localhost' ||
              host === '127.0.0.1' ||
              host === '::1' ||
              host === '::' ||
              host.startsWith('169.254.')
            ) {
              return false;
            }
            if (host.startsWith('10.')) return false;
            if (host.startsWith('192.168.')) return false;
            if (host.startsWith('172.')) {
              const parts = host.split('.');
              const second = parseInt(parts[1], 10);
              if (second >= 16 && second <= 31) return false;
            }
            return true;
          } catch {
            return false;
          }
        },
      },
    });
  };
}

export class RegisterPushSubscriptionDto {
  @ApiProperty()
  @IsSafePushEndpoint({ message: 'Endpoint must be a valid HTTPS push service endpoint' })
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
