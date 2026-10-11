import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, Matches } from 'class-validator';
import { ContactChannel } from '@prisma/client';

export class RequestContactCodeDto {
  @ApiProperty({ enum: ContactChannel })
  @IsEnum(ContactChannel)
  channel: ContactChannel;
}

export class ConfirmContactCodeDto {
  @ApiProperty({ enum: ContactChannel })
  @IsEnum(ContactChannel)
  channel: ContactChannel;

  @ApiProperty({ example: '482913' })
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;
}
