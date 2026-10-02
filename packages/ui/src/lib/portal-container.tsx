'use client'

import { createContext, type ReactNode, use } from 'react'

/** Where overlays (tooltip, menu, dialog, toast) are portaled. Radix accepts an element or a shadow root. */
export type PortalTarget = Element | DocumentFragment

const PortalContainerContext = createContext<PortalTarget | null>(null)

export interface PortalContainerProviderProps {
  /**
   * Portal target for every overlay below this provider. The extension passes its shadow root
   * (or an element inside it) so overlays render where the UI's styles live.
   */
  container: PortalTarget | null
  children: ReactNode
}

export function PortalContainerProvider({ container, children }: PortalContainerProviderProps) {
  return <PortalContainerContext value={container}>{children}</PortalContainerContext>
}

/** The portal target for overlays; undefined lets Radix fall back to document.body. */
export function usePortalContainer(): PortalTarget | undefined {
  return use(PortalContainerContext) ?? undefined
}
