import { Module } from '@nestjs/common';
import { ServicesModule } from '../services/services.module';
import { CategoriesModule } from '../categories/categories.module';
import { FilesModule } from '../files/files.module';
import { RequestAssistController } from './request-assist.controller';
import { RequestAssistService } from './request-assist.service';
import { AnthropicAssistProvider } from './providers/anthropic-assist.provider';
import { MockAssistProvider } from './providers/mock-assist.provider';
import { REQUEST_ASSIST_PROVIDER } from './assist-provider.interface';

@Module({
  imports: [ServicesModule, CategoriesModule, FilesModule],
  controllers: [RequestAssistController],
  providers: [
    RequestAssistService,
    {
      provide: REQUEST_ASSIST_PROVIDER,
      useFactory: () => {
        // Falls back to the offline mock without a key so the app (and
        // this repo's build/test pass) runs fully offline in development,
        // same pattern as MAP_PROVIDER/PaymentProvider.
        if (process.env.ANTHROPIC_API_KEY) return new AnthropicAssistProvider();
        return new MockAssistProvider();
      },
    },
  ],
})
export class RequestAssistModule {}
