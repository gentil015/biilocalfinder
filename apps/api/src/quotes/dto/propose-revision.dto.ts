import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ProposeRevisionDto {
  @ApiProperty({ description: 'The counter-proposed price' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ required: false, example: 'Can you do this for 25,000 RWF?' })
  @IsOptional()
  @IsString()
  message?: string;
}
