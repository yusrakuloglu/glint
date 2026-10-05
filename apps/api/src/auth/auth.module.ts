import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { createRemoteJWKSet } from 'jose'

import { ENV, type Env } from '../config/env.js'

import { AccessTokenVerifier, JWT_KEY_RESOLVER } from './access-token-verifier.js'
import { AuthGuard } from './auth.guard.js'

@Module({
  providers: [
    {
      provide: JWT_KEY_RESOLVER,
      inject: [ENV],
      // Keys are fetched lazily and cached; an unknown `kid` triggers a refetch
      // at most once per cooldown, so key rotation needs no redeploy
      useFactory: (env: Env) =>
        createRemoteJWKSet(new URL('/auth/v1/.well-known/jwks.json', env.SUPABASE_URL)),
    },
    AccessTokenVerifier,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
