import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { MAX_ASSIST_TEXT_LENGTH } from '../assist-provider.interface';

export class SuggestRequestDto {
  // Explicit opt-in to sending the description/image to a third-party AI
  // provider. The web UI shows this before the first request.
  @IsBoolean()
  consentToProcess!: boolean;

  @IsString()
  serviceId!: string;

  // Length-capped server-side regardless of what a client sends — bounds
  // both prompt size/cost and abuse surface (spec pattern: never trust a
  // client-supplied size for anything fed to a paid external call).
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ASSIST_TEXT_LENGTH)
  description?: string;

  // A storage key already returned by POST /files/upload — this endpoint
  // never accepts raw image bytes directly, it only reads back something
  // the upload endpoint already validated (MIME allow-list, size cap).
  @IsOptional()
  @IsString()
  imageKey?: string;
}
