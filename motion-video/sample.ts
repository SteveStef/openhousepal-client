// The example video ("See an example") and the default props for the worker's composition: three
// photos of a sample listing (847 Lesley Rd, Villanova - not an OpenHousePal agent's listing, so it
// carries no agent and credits the listing brokerage), served as static files.
import { DEFAULT_SECTIONS } from './presets'
import type { MotionPhoto, MotionProps } from './types'

export const SAMPLE_PHOTOS: MotionPhoto[] = [
  { id: 'ex-front', src: '/motion/example/front.jpg', depth: '/motion/example/front-depth.jpg', kind: 'exterior', label: 'A stone Colonial, circa 1929', kicker: 'Curb appeal', showLabel: true, move: 'auto', focusX: 0.5, lights: true, sky: true, trees: true },
  { id: 'ex-living', src: '/motion/example/living.jpg', depth: '/motion/example/living-depth.jpg', kind: 'living', label: 'Sunlit rooms, refined millwork', kicker: 'Living', showLabel: true, move: 'slide_left', focusX: 0.55 },
  { id: 'ex-aerial', src: '/motion/example/aerial.jpg', depth: '/motion/example/aerial-depth.jpg', kind: 'aerial', label: 'Pool and gardens on 0.85 acres', kicker: 'Outdoors', showLabel: true, move: 'auto', focusX: 0.55, water: true, trees: true },
]

/** Extra sample rooms for the style / transition previews. */
export const SAMPLE_EXTRA: MotionPhoto[] = [
  { id: 'ex-dining', src: '/motion/example/dining.jpg', depth: '/motion/example/dining-depth.jpg', kind: 'dining', label: 'Gracious formal dining', kicker: 'Entertaining', showLabel: true, move: 'auto', focusX: 0.5 },
  { id: 'ex-library', src: '/motion/example/library.jpg', depth: '/motion/example/library-depth.jpg', kind: 'office', label: 'Built-ins and French doors', kicker: 'The library', showLabel: true, move: 'auto', focusX: 0.5 },
  { id: 'ex-facade', src: '/motion/example/facade.jpg', depth: '/motion/example/facade-depth.jpg', kind: 'exterior', label: 'Set on a private lane', kicker: 'Curb appeal', showLabel: true, move: 'orbit', focusX: 0.45, lights: true, sky: true, trees: true },
]

export const SAMPLE_PROPS: MotionProps = {
  photos: SAMPLE_PHOTOS,
  theme: 'classic',
  accent: '#C9A24D',
  metal: 'gold',
  style: 'cinematic',
  transition: 'cut',
  situation: 'just_listed',
  copy: { tagline: 'Some homes simply have a soul' },
  facts: {
    address: '847 Lesley Road', cityLine: 'Villanova, PA', price: '$3,199,000',
    beds: '5', baths: '5.5', sqft: '6,198', acres: '0.85',
    courtesy: 'Sample listing · courtesy of BHHS Fox & Roach',
  },
  agent: { name: '' },
  sections: { ...DEFAULT_SECTIONS, agent: 'off' },
  music: 'elegant',
  format: '16:9',
}
