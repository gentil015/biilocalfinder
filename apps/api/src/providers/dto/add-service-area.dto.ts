import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsNumber, IsString, Min } from 'class-validator';

export class AddServiceAreaDto {
  @ApiProperty()
  @IsString()
  label: string;

  @ApiProperty()
  @IsLatitude()
  latitude: number;

  @ApiProperty()
  @IsLongitude()
  longitude: number;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  radiusKm: number;
}
