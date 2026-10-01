import { useEffect, useRef, useState } from 'react'

/**
 * Renders the exact email HTML that gets exported, in an isolated frame (no scripts).
 * Desktop shows the full template width scaled to fit; mobile renders at phone width so the
 * template's own mobile rules (one column, full-width buttons) are what you see.
 */
export function EmailPreview({ html, width, mode, title }: { html: string; width: number; mode: 'desktop' | 'mobile'; title: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [available, setAvailable] = useState(0)
  const [contentHeight, setContentHeight] = useState(900)

  const frameWidth = mode === 'mobile' ? 375 : width + 40
  const scale = available ? Math.min(1, available / frameWidth) : 1

  useEffect(() => {
    const node = wrapRef.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  function measure() {
    const body = frameRef.current?.contentDocument?.body
    if (body) setContentHeight(Math.max(body.scrollHeight, 200))
  }

  useEffect(() => {
    // Re-measure after edits re-render the frame.
    const timer = window.setTimeout(measure, 60)
    return () => window.clearTimeout(timer)
  }, [html, mode])

  return (
    <div className="email-frame-wrap" ref={wrapRef} style={{ height: contentHeight * scale }}>
      <iframe
        ref={frameRef}
        title={title}
        srcDoc={html}
        sandbox="allow-same-origin"
        onLoad={measure}
        className={`email-frame ${mode}`}
        style={{ width: frameWidth, height: contentHeight, transform: `scale(${scale})`, left: mode === 'mobile' ? `calc(50% - ${(frameWidth * scale) / 2}px)` : 0 }}
      />
    </div>
  )
}
