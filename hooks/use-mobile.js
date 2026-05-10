import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    const timer = setTimeout(onChange, 0)
    mql.addEventListener("change", onChange)
    return () => {
      clearTimeout(timer)
      mql.removeEventListener("change", onChange)
    };
  }, [])

  return !!isMobile
}
