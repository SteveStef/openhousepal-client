// Agent Hub favourites: a video or house tour the agent starred always shows first, in the order
// they arranged their favourites; everything else (new channel uploads included) fills in after.
// The backend applies the same rule (agent_hub_video_sync.merge_videos, content_adapters._hub_items)
// so the hub, its editor preview and the IDX Media page all agree.
export function pinnedFirst<T extends { pinned?: boolean }>(items: T[]): T[] {
  return [...items.filter(i => i.pinned), ...items.filter(i => !i.pinned)]
}
