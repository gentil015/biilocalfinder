import { Module } from '@nestjs/common';
import { ServicesModule } from '../services/services.module';
import { CategoriesModule } from '../categories/categories.module';
import { SearchAssistController } from './search-assist.controller';
import { SearchAssistService } from './search-assist.service';
import { GeminiSearchAssistProvider } from './providers/gemini-search-assist.provider';
import { GroqSearchAssistProvider } from './providers/groq-search-assist.provider';
import { MockSearchAssistProvider } from './providers/mock-search-assist.provider';
import { SEARCH_ASSIST_PROVIDER } from './search-assist.interface';

@Module({
  imports: [ServicesModule, CategoriesModule],
  controllers: [SearchAssistController],
  providers: [
    SearchAssistService,
    {
      provide: SEARCH_ASSIST_PROVIDER,
      useFactory: () => {
        // Same boot-time vendor selection as BookingAssistModule: Groq takes
        // precedence while the Gemini free-tier quota is exhausted — unset
        // GROQ_API_KEY to fall back to Gemini. Without either key it falls
        // back to the offline mock so the feature (and this repo's build/
        // test) still works fully offline in development. Selection happens
        // at boot: set the key, then restart for it to take effect.
        if (process.env.GROQ_API_KEY) return new GroqSearchAssistProvider();
        if (process.env.GEMINI_API_KEY) return new GeminiSearchAssistProvider();
        return new MockSearchAssistProvider();
      },
    },
  ],
})
export class SearchAssistModule {}
