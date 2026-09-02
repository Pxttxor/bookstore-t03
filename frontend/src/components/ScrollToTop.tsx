import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

// React Router keeps the window scrolled where it was when the route changes, so opening
// a detail screen from halfway down a table lands you halfway down the new screen.
//
// Keyed on pathname only, never on search: the TopNav search box rewrites ?q= on every
// keystroke, and including it here would jerk the page to the top as the user types.
// useLayoutEffect so the jump happens before the browser paints the new screen.
export default function ScrollToTop() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
