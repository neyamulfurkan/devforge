import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'

interface DevProbeConfig {
  apiBaseUrl: string
  projectId: string
  enabled: boolean
}

export function useDevProbeSetup(config: DevProbeConfig) {
  const { user } = useAuth()

  useEffect(() => {
    if (!config.enabled || !user?.id || !config.projectId) {
      return
    }

    // Store DevForge API endpoint for DevProbe to use
    const devProbeConfig = {
      devforgeApiUrl: `${window.location.origin}/api/devprobe`,
      projectId: config.projectId,
      userId: user.id,
    }

    // Make available to window for external DevProbe tool
    ;(window as any).__DEVFORGE_DEVPROBE_CONFIG__ = devProbeConfig

    // Optional: Test connection
    const testConnection = async () => {
      try {
        const response = await fetch(`${devProbeConfig.devforgeApiUrl}/ping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        if (response.ok) {
          console.log('[DevProbe] Connected to DevForge')
        }
      } catch (error) {
        console.warn('[DevProbe] Could not connect to DevForge:', error)
      }
    }

    testConnection()
  }, [config.enabled, user?.id, config.projectId])
}