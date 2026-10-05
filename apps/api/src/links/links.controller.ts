import { Controller } from '@nestjs/common'

import { type AuthUser } from '../auth/auth-user.js'
import { CurrentUser } from '../auth/current-user.decorator.js'
import { type EndpointInput, type EndpointResult } from '../common/contract/endpoint-contract.js'
import { Endpoint, Input } from '../common/contract/endpoint.decorator.js'

import { createLink, deleteLink, getLink, listLinks, updateLink } from './links.contracts.js'
import { LinksService } from './links.service.js'

@Controller()
export class LinksController {
  constructor(private readonly links: LinksService) {}

  @Endpoint(createLink)
  create(
    @CurrentUser() user: AuthUser,
    @Input() { body }: EndpointInput<typeof createLink>
  ): Promise<EndpointResult<typeof createLink>> {
    return this.links.save(user.id, body)
  }

  @Endpoint(listLinks)
  list(
    @CurrentUser() user: AuthUser,
    @Input() { query }: EndpointInput<typeof listLinks>
  ): Promise<EndpointResult<typeof listLinks>> {
    return this.links.list(user.id, query)
  }

  @Endpoint(getLink)
  get(
    @CurrentUser() user: AuthUser,
    @Input() { params }: EndpointInput<typeof getLink>
  ): Promise<EndpointResult<typeof getLink>> {
    return this.links.get(user.id, params.id)
  }

  @Endpoint(updateLink)
  update(
    @CurrentUser() user: AuthUser,
    @Input() { params, body }: EndpointInput<typeof updateLink>
  ): Promise<EndpointResult<typeof updateLink>> {
    return this.links.update(user.id, params.id, body)
  }

  @Endpoint(deleteLink)
  async remove(
    @CurrentUser() user: AuthUser,
    @Input() { params }: EndpointInput<typeof deleteLink>
  ): Promise<EndpointResult<typeof deleteLink>> {
    await this.links.softDelete(user.id, params.id)
    return undefined
  }
}
