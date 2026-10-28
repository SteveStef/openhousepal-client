import OhpLoader from '@/components/brand/OhpLoader'

// Shown while Manager loads - it's the agent's own listings, not open houses (user, 10/27).
export default function Loading() {
  return <OhpLoader label="Opening your listings" />
}
