import { Processor, WorkerHost } from '@nestjs/bullmq';
import { DataRetentionService } from './data-retention.service';
import { DATA_RETENTION_QUEUE } from './data-retention.constants';

@Processor(DATA_RETENTION_QUEUE)
export class DataRetentionProcessor extends WorkerHost {
  constructor(private retention: DataRetentionService) {
    super();
  }

  async process() {
    return this.retention.purge();
  }
}
