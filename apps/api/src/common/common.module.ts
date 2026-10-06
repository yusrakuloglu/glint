import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'

import { ProblemDetailsFilter } from './problem-details.filter.js'
import { RequestIdMiddleware } from './request-id.middleware.js'

@Module({
  providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*path')
  }
}
