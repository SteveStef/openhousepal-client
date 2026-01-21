'use client'

import { useState, useEffect, useRef } from 'react'

interface TypingAnimationProps {
  text: string
  onComplete?: () => void
  speed?: number
  startDelay?: number
}

export default function TypingAnimation({ 
  text, 
  onComplete, 
  speed = 50, 
  startDelay = 0 
}: TypingAnimationProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [started, setStarted] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  
  // Use ref to track onComplete to avoid effect re-triggering
  const onCompleteRef = useRef(onComplete)
  
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    let timeout: NodeJS.Timeout
    
    // Initial delay
    const startTimeout = setTimeout(() => {
      setStarted(true)
    }, startDelay)

    return () => clearTimeout(startTimeout)
  }, [startDelay])

  useEffect(() => {
    if (!started) return

    let currentIndex = 0
    const interval = setInterval(() => {
      if (currentIndex <= text.length) {
        setDisplayedText(text.slice(0, currentIndex))
        currentIndex++
      } else {
        clearInterval(interval)
        setIsCompleted(true)
        if (onCompleteRef.current) {
          // Add a small pause after typing finishes before triggering complete
          setTimeout(() => onCompleteRef.current?.(), 500)
        }
      }
    }, speed)

    return () => clearInterval(interval)
  }, [started, text, speed]) // Removed onComplete from dependencies

  return (
    <span className="inline-flex items-center">
      {displayedText}
      {!isCompleted && <span className="w-[2px] h-4 bg-[#8b7355] ml-[1px] animate-pulse"></span>}
    </span>
  )
}
