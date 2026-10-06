import { Module } from '@nestjs/common'

import { ProcessingModule } from '../processing/processing.module.js'

import { LinksController } from './links.controller.js'
import { LinksService } from './links.service.js'

@Module({
  imports: [ProcessingModule],
  controllers: [LinksController],
  providers: [LinksService],
})
export class LinksModule {}
