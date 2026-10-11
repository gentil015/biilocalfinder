import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

// Only these two roles can ever self-register. ADMIN accounts are
// provisioned separately (seed script / an existing admin's own tooling)
// — never through this public endpoint. @IsEnum(UserRole) would have
// been a real security bug here: it validates against the *full* Prisma
// enum (CLIENT/PROVIDER/ADMIN), silently contradicting the @ApiProperty
// docs below and letting a direct API call register as ADMIN.
export const REGISTERABLE_ROLES = ['CLIENT', 'PROVIDER'] as const;
export type RegisterableRole = (typeof REGISTERABLE_ROLES)[number];

export class RegisterDto {
  // Normalised before validation. The `users_email_key` unique index is a
  // plain B-tree on TEXT, so it is case- and whitespace-sensitive: without
  // this, `Dushimegentil0@Gmail.com` and `dushimegentil0@gmail.com` are two
  // distinct accounts for the same mailbox (Gmail itself treats them as one),
  // and the duplicate pre-check in AuthService.register can't see them either.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @ApiProperty()
  @IsEmail()
  email: string;

  // An empty string is not a phone number, but @IsOptional() only skips
  // null/undefined — it happily accepted ''. That stored '' into the
  // `users_phone_key` unique index, so the *second* signup that omitted its
  // phone collided with the first and failed with a unique violation.
  // Mapping '' back to undefined makes it a genuine SQL NULL, which Postgres
  // does not consider a duplicate.
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty({ enum: REGISTERABLE_ROLES })
  @IsIn(REGISTERABLE_ROLES)
  role: RegisterableRole;
}
