import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class RequestPasswordResetDto {
  // Must mirror LoginDto/RegisterDto. The lookup behind this is an exact
  // `findUnique({ email })`, so an un-normalised address ("Admin@Bii.dev")
  // silently matches nothing and the user gets no email at all — with the
  // enumeration-safe response telling them one was sent.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @ApiProperty()
  @IsEmail()
  email: string;
}
