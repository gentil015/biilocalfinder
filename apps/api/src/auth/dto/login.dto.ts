import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  // Must mirror RegisterDto.email's normalisation, otherwise an address
  // registered in one casing becomes unloggable in another (login does an
  // exact `findUnique({ email })`).
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  password: string;
}
