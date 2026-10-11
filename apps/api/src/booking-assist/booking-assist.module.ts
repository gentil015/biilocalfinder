import { Module } from '@nestjs/common';
import { ServicesModule } from '../services/services.module';
import { CategoriesModule } from '../categories/categories.module';
import { BookingAssistController } from './booking-assist.controller';
import { BookingAssistService } from './booking-assist.service';
import { GeminiBookingAssistProvider } from './providers/gemini-booking-assist.provider';
import { GroqBookingAssistProvider } from './providers/groq-booking-assist.provider';
import { MockBookingAssistProvider } from './providers/mock-booking-assist.provider';
import { BOOKING_ASSIST_PROVIDER } from './booking-assist.interface';

@Module({
  imports: [ServicesModule, CategoriesModule],
  controllers: [BookingAssistController],
  providers: [
    BookingAssistService,
    {
      provide: BOOKING_ASSIST_PROVIDER,
      useFactory: () => {
        // Groq takes precedence while the Gemini free-tier quota (20
        // requests/hour) is exhausted — unset GROQ_API_KEY to fall back to
        // Gemini. Without either key it falls back to the offline mock so
        // the app (and this repo's build/test) run fully offline in
        // development, same pattern as MAP_PROVIDER/PaymentProvider/
        // RequestAssistProvider. Selection happens at boot: set the key,
        // then restart (or touch a file) for it to take effect.
        if (process.env.GROQ_API_KEY) return new GroqBookingAssistProvider();
        if (process.env.GEMINI_API_KEY) return new GeminiBookingAssistProvider();
        return new MockBookingAssistProvider();
      },
    },
  ],
})
export class BookingAssistModule {}
