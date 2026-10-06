import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'glint:isPublic'

/** Skips authentication. Every route requires a valid access token unless marked. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
