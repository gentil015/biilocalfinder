import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderAttributesDto {
  @ApiProperty({ type: [String], description: 'Attribute IDs in the desired display order' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  attributeIds: string[];
}
