/** The authenticated caller, taken from a verified Supabase access token. */
export interface AuthUser {
  /** Supabase auth user id (`sub` claim) */
  id: string
}
