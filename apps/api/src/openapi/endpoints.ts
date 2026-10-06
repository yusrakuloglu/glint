import { type EndpointContract } from '../common/contract/endpoint-contract.js'
import { healthCheck } from '../health/health.contracts.js'
import { createLink, deleteLink, getLink, listLinks, updateLink } from '../links/links.contracts.js'

/**
 * Every contract served by the API. A unit test compares this list with the
 * routes registered through @Endpoint(), so a new endpoint cannot be left out
 * of the OpenAPI document.
 */
export const endpoints: readonly EndpointContract[] = [
  healthCheck,
  listLinks,
  createLink,
  getLink,
  updateLink,
  deleteLink,
]
