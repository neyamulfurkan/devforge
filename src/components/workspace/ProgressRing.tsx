'use client'

// 1. React imports
import { useEffect, useRef } from 'react'

// 5. Internal imports — utils
import { cn } from '@/lib/utils'

// 6. Local types
interface ProgressRingProps {
  percentage: number
  size?: number
  strokeWidth?: number
  label?: string
  sublabel?: string
  className?: string
}

export function ProgressRing({
  percentage,
  size = 120,
  strokeWidth = 8,
  label,
  sublabel,
  className,
}: ProgressRingProps): JSX.Element {
  // Clamp percentage to 0–100
  const clamped = Math.min(100, Math.max(0, percentage))

  // SVG geometry
  const center = size / 2
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius

  // The arc progress element ref — we animate via a direct style mutation
  // after mount using requestAnimationFrame so CSS transition fires correctly.
  const arcRef = useRef<SVGCircleElement>(null)

  useEffect(() => {
    const arc = arcRef.current
    if (!arc) return

    // Start at full offset (hidden) on the first paint tick, then let the
    // CSS transition animate to the target offset on the next frame.
    const targetOffset = circumference - (clamped / 100) * circumference

    arc.style.strokeDashoffset = String(circumference)

    const raf = requestAnimationFrame(() => {
      arc.style.strokeDashoffset = String(targetOffset)
    })

    return () => cancelAnimationFrame(raf)
  }, [clamped, circumference])

  // Font sizes scale with ring size
  const percentageFontSize = Math.max(12, Math.round(size * 0.22))
  const labelFontSize = Math.max(9, Math.round(size * 0.11))
  const sublabelFontSize = Math.max(8, Math.round(size * 0.09))

  // Vertical positioning of the text cluster within the SVG center
  const labelLineHeight = labelFontSize * 1.4
  const sublabelLineHeight = sublabelFontSize * 1.4
  const totalTextHeight =
    percentageFontSize +
    (label ? labelLineHeight : 0) +
    (sublabel ? sublabelLineHeight : 0)

  // Center the text cluster vertically
  const textStartY = center - totalTextHeight / 2 + percentageFontSize * 0.35

  return (
    <div
      className={cn('inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `${clamped}% complete`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        overflow="visible"
      >
        {/* Track circle (background) */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="var(--border-default)"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress arc */}
        <circle
          ref={arcRef}
          cx={center}
          cy={center}
          r={radius}
          stroke="var(--accent-primary)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          // Initial value — will be updated in the useEffect with transition
          strokeDashoffset={circumference - (clamped / 100) * circumference}
          // Rotate so the arc starts at the top (12 o'clock)
          transform={`rotate(-90, ${center}, ${center})`}
          style={{
            transition: 'stroke-dashoffset 600ms ease-out',
            filter: clamped > 0 ? 'drop-shadow(0 0 4px var(--accent-primary))' : undefined,
          }}
        />

        {/* Text cluster — SVG text elements positioned from computed start */}
        <text
          x={center}
          y={textStartY}
          textAnchor="middle"
          dominantBaseline="auto"
          fontSize={percentageFontSize}
          fontWeight="700"
          fill="var(--text-primary)"
          style={{ fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}
        >
          {clamped}%
        </text>

        {label && (
          <text
            x={center}
            y={textStartY + percentageFontSize * 0.3 + labelLineHeight}
            textAnchor="middle"
            dominantBaseline="auto"
            fontSize={labelFontSize}
            fontWeight="500"
            fill="var(--text-secondary)"
            style={{ fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}
          >
            {label}
          </text>
        )}

        {sublabel && (
          <text
            x={center}
            y={
              textStartY +
              percentageFontSize * 0.3 +
              (label ? labelLineHeight : 0) +
              sublabelLineHeight
            }
            textAnchor="middle"
            dominantBaseline="auto"
            fontSize={sublabelFontSize}
            fontWeight="400"
            fill="var(--text-tertiary)"
            style={{ fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}
          >
            {sublabel}
          </text>
        )}
      </svg>
    </div>
  )
}

export default ProgressRing