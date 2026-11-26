import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsIn, IsOptional, IsString } from 'class-validator';
import { CURRENT_TERMS_VERSION } from '../../legal/terms.constants';
import { REGISTERABLE_ROLES, type RegisterableRole } from './register.dto';

export class GoogleAuthDto {
  @ApiProperty({ description: 'Google ID token from Google Sign-In / Google Identity Services' })
  @IsString()
  idToken: string;

  @ApiPropertyOptional({ enum: REGISTERABLE_ROLES, description: 'Required only when creating a new account' })
  @IsOptional()
  @IsIn(REGISTERABLE_ROLES)
  role?: RegisterableRole;

  @ApiPropertyOptional({ enum: [true], description: 'Required only when creating a new account' })
  @IsOptional()
  @Equals(true)
  termsAccepted?: true;

  @ApiPropertyOptional({ example: CURRENT_TERMS_VERSION, description: 'Required only when creating a new account' })
  @IsOptional()
  @IsString()
  @Equals(CURRENT_TERMS_VERSION)
  termsVersion?: string;
}
