import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * useSyncExternalStore rather than effect + setState: the media query is an external
 * system, and this way the first client render already matches the server (false).
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
      mql.addEventListener("change", onStoreChange)
      return () => mql.removeEventListener("change", onStoreChange)
    },
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  )
}
