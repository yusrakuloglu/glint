import { Controller, Get, Req, Res } from '@nestjs/common'
import { apiReference } from '@scalar/nestjs-api-reference'

import { Public } from '../auth/public.decorator.js'
import { type HttpRequest, type HttpResponse } from '../common/http.js'

import { createOpenApiDocument } from './openapi-document.js'

const OPENAPI_PATH = '/openapi.json'

// `withFastify` makes Scalar write through the plain node:http response API,
// which Express responses also support (no @types/express needed)
const renderDocs = apiReference({
  url: OPENAPI_PATH,
  pageTitle: 'Glint API',
  withFastify: true,
})

@Public()
@Controller()
export class OpenApiController {
  private readonly document = createOpenApiDocument()

  @Get(OPENAPI_PATH)
  spec() {
    return this.document
  }

  /** Interactive reference (Scalar); loads its UI script from a CDN. */
  @Get('/docs')
  docs(@Req() request: HttpRequest, @Res() response: HttpResponse) {
    renderDocs(request, response)
  }
}
