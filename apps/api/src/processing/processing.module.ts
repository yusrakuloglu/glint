import { Module } from '@nestjs/common'

import { ContentIngestService } from './content-ingest.service.js'

@Module({
  providers: [ContentIngestService],
  exports: [ContentIngestService],
})
export class ProcessingModule {}
