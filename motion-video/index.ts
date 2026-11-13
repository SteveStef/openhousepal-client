// Entry for the video worker's bundle (video-worker/server.mjs). The app itself never imports this
// file - it uses MotionFilm directly inside @remotion/player.
import React from 'react'
import { Composition, registerRoot } from 'remotion'
import { MotionFilm, motionFrames } from './MotionFilm'
import { SAMPLE_PROPS } from './sample'
import { FORMAT_SIZE, FPS, type MotionProps } from './types'

const Root: React.FC = () =>
  React.createElement(Composition, {
    id: 'CinematicVideo',
    component: MotionFilm as unknown as React.FC<Record<string, unknown>>,
    fps: FPS,
    width: 1920,
    height: 1080,
    durationInFrames: 240,
    defaultProps: SAMPLE_PROPS as unknown as Record<string, unknown>,
    calculateMetadata: ({ props }: { props: Record<string, unknown> }) => {
      const p = props as unknown as MotionProps
      const size = FORMAT_SIZE[p.format] || FORMAT_SIZE['16:9']
      return { durationInFrames: motionFrames(p), width: size.w, height: size.h, fps: FPS }
    },
  })

registerRoot(Root)
