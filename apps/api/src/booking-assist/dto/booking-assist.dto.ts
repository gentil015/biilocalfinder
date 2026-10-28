import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  BOOKING_ASSIST_LANGUAGES,
  BookingAssistLanguage,
  MAX_BOOKING_ASSIST_HISTORY,
  MAX_BOOKING_ASSIST_TEXT_LENGTH,
} from '../booking-assist.interface';

export class BookingAssistMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  // Length-capped server-side regardless of what the client sends — bounds
  // both prompt size/cost and abuse surface (spec pattern: never trust a
  // client-supplied size for anything fed to a paid external call).
  @IsString()
  @MaxLength(MAX_BOOKING_ASSIST_TEXT_LENGTH)
  text!: string;
}

export class BookingAssistDto {
  // Explicit opt-in to sending this text to a third-party AI provider.
  // Defaulting to false would make the endpoint unusable from the web app
  // without a code change, so the field is required and the web client sets
  // it after showing the privacy notice.
  @IsBoolean()
  consentToProcess!: boolean;

  @IsString()
  @MaxLength(MAX_BOOKING_ASSIST_TEXT_LENGTH)
  message!: string;

  // Prior turns of this conversation, oldest first. The endpoint is
  // stateless (same as request-assist) — the client carries the context.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_BOOKING_ASSIST_HISTORY)
  @ValidateNested({ each: true })
  @Type(() => BookingAssistMessageDto)
  history?: BookingAssistMessageDto[];

  // Optional language hint (e.g. the signed-in user's locale). The model
  // still matches the client's actual message language when it can.
  @IsOptional()
  @IsIn(BOOKING_ASSIST_LANGUAGES)
  language?: BookingAssistLanguage;

  // The service currently selected in the form, if any — pins the
  // assistant to that service (and unlocks its category questions)
  // instead of letting the model re-pick.
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  // Required fields the client already filled in manually — lets the
  // assistant only ask about what is genuinely still missing.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsIn(['service', 'title', 'description'], { each: true })
  filledFields?: ('service' | 'title' | 'description')[];
}
