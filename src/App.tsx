import { useState, useEffect } from 'react'
import SolitaireGame from './klondike'
import MobileKlondikeSolitaire from './klondike-mobile'

function App() {
  const [isMobile, setIsMobile] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [manualOverride, setManualOverride] = useState(null) // null, 'mobile', 'desktop'

  useEffect(() => {
    const checkMobile = () => {
      // Check for mobile devices using multiple methods
      const userAgent = navigator.userAgent.toLowerCase()
      const isMobileAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      const isSmallScreen = window.innerWidth <= 768
      
      // Consider it mobile if it's a mobile device OR a small touch screen
      const mobile = isMobileAgent || (isTouchDevice && isSmallScreen)
      
      setIsMobile(mobile)
      setIsLoading(false)
    }

    // Check initially
    checkMobile()

    // Listen for resize events to handle orientation changes
    const handleResize = () => {
      const isSmallScreen = window.innerWidth <= 768
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      const userAgent = navigator.userAgent.toLowerCase()
      const isMobileAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
      
      setIsMobile(isMobileAgent || (isTouchDevice && isSmallScreen))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Show loading screen briefly while determining device type
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#0f5132',
        color: 'white',
        fontSize: '18px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        Loading Klondike Solitaire...
      </div>
    )
  }

  // Determine which version to show
  const showMobile = manualOverride === 'mobile' || (manualOverride === null && isMobile)
  const showDesktop = manualOverride === 'desktop' || (manualOverride === null && !isMobile)

  // Version toggle button
  const VersionToggle = () => (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      zIndex: 9999,
      display: 'flex',
      gap: '8px'
    }}>
      <button
        onClick={() => setManualOverride(showMobile ? 'desktop' : 'mobile')}
        style={{
          padding: '8px 12px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '6px',
          fontSize: '12px',
          cursor: 'pointer',
          backdropFilter: 'blur(10px)'
        }}
        title={showMobile ? 'Switch to Desktop Version' : 'Switch to Mobile Version'}
      >
        {showMobile ? '🖥️' : '📱'}
      </button>
    </div>
  )

  // Render appropriate version
  return (
    <div>
      <VersionToggle />
      {showMobile ? <MobileKlondikeSolitaire /> : <SolitaireGame />}
    </div>
  )
}

export default App