import { Module } from '@nestjs/common';
import { ServicesModule } from '../services/services.module';
import { CustomerAssistController } from './customer-assist.controller';
import { CustomerAssistService } from './customer-assist.service';
import { GroqCustomerAssistProvider } from './providers/groq-customer-assist.provider';
import { GeminiCustomerAssistProvider } from './providers/gemini-customer-assist.provider';
import { MockCustomerAssistProvider } from './providers/mock-customer-assist.provider';
import { CUSTOMER_ASSIST_PROVIDER } from './customer-assist.interface';

@Module({
  imports: [ServicesModule],
  controllers: [CustomerAssistController],
  providers: [
    CustomerAssistService,
    {
      provide: CUSTOMER_ASSIST_PROVIDER,
      useFactory: () => {
        // Same boot-time vendor selection as BookingAssistModule: Groq takes
        // precedence while the Gemini free-tier quota is exhausted — unset
        // GROQ_API_KEY to fall back to Gemini. Without either key it falls
        // back to the keyword mock so the app (and this repo's build/test)
        // run fully offline in development. Selection happens at boot: set
        // the key, then restart for it to take effect.
        if (process.env.GROQ_API_KEY) return new GroqCustomerAssistProvider();
        if (process.env.GEMINI_API_KEY) return new GeminiCustomerAssistProvider();
        return new MockCustomerAssistProvider();
      },
    },
  ],
})
export class CustomerAssistModule {}