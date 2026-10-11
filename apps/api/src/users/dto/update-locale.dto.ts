import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { SUPPORTED_LOCALES } from '../../common/locales';

export class UpdateLocaleDto {
  @ApiProperty({
    enum: SUPPORTED_LOCALES,
    description: 'BCP-47 tag of the display language to use for this account',
  })
  @IsIn(SUPPORTED_LOCALES)
  locale: string;
}
