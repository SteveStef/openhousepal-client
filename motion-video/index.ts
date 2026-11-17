// Entry for the video worker's bundle (video-worker/server.mjs). The app itself never imports this
// file - it uses MotionFilm directly inside @remotion/player.
import React from 'react'
import { Composition, registerRoot } from 'remotion'
import { FastFilm, type FastProps } from './FastFilm'
import { MotionFilm, motionFrames } from './MotionFilm'
import { SAMPLE_PROPS } from './sample'
import { FORMAT_SIZE, FPS, type MotionProps } from './types'

const Cinematic: React.FC = () =>
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

// Fast Cut (11/14): the beat-synced kind of AI Video - its props are a ready shot list
// (backend/app/services/fast_cut_planner.py).
const EMPTY_FAST: FastProps = { shots: [], format: '9:16', duration: 3 }
const Fast: React.FC = () =>
  React.createElement(Composition, {
    id: 'FastCut',
    component: FastFilm as unknown as React.FC<Record<string, unknown>>,
    fps: FPS,
    width: 1080,
    height: 1920,
    durationInFrames: 90,
    defaultProps: EMPTY_FAST as unknown as Record<string, unknown>,
    calculateMetadata: ({ props }: { props: Record<string, unknown> }) => {
      const p = props as unknown as FastProps
      const size = FORMAT_SIZE[p.format] || FORMAT_SIZE['9:16']
      return { durationInFrames: Math.max(FPS, Math.round(p.duration * FPS)), width: size.w, height: size.h, fps: FPS }
    },
  })

const Root: React.FC = () => React.createElement(React.Fragment, null, React.createElement(Cinematic), React.createElement(Fast))

registerRoot(Root)
