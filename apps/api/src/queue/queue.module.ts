import { type DynamicModule, Module } from '@nestjs/common'

import { QUEUE_MODULE_OPTIONS, type QueueModuleOptions, QueueService } from './queue.service.js'

@Module({})
export class QueueModule {
  static forRoot(options: QueueModuleOptions): DynamicModule {
    return {
      module: QueueModule,
      global: true,
      providers: [{ provide: QUEUE_MODULE_OPTIONS, useValue: options }, QueueService],
      exports: [QueueService],
    }
  }
}
