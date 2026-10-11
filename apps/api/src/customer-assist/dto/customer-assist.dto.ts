import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  CUSTOMER_ASSIST_LANGUAGES,
  CustomerAssistLanguage,
  MAX_CUSTOMER_ASSIST_HISTORY,
  MAX_CUSTOMER_ASSIST_TEXT_LENGTH,
} from '../customer-assist.interface';

export class CustomerAssistMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  // Length-capped server-side regardless of what the client sends — bounds
  // both prompt size/cost and abuse surface (spec pattern: never trust a
  // client-supplied size for anything fed to a paid external call).
  @IsString()
  @MaxLength(MAX_CUSTOMER_ASSIST_TEXT_LENGTH)
  text!: string;
}

export class CustomerAssistDto {
  @IsString()
  @MaxLength(MAX_CUSTOMER_ASSIST_TEXT_LENGTH)
  message!: string;

  // Prior turns of this conversation, oldest first. The endpoint is
  // stateless (same as booking-assist/request-assist) — the client carries
  // the context back on every turn.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CUSTOMER_ASSIST_HISTORY)
  @ValidateNested({ each: true })
  @Type(() => CustomerAssistMessageDto)
  history?: CustomerAssistMessageDto[];

  // Optional language hint (e.g. the signed-in user's locale). The model
  // still matches the client's actual message language when it can.
  @IsOptional()
  @IsIn(CUSTOMER_ASSIST_LANGUAGES)
  language?: CustomerAssistLanguage;
}