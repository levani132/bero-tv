import { JsonApiNode, ApiChannelAttrs } from "../models/api-models";
import { Channel, Category, DvrWindow } from "../models/channel";

// Pull a usable logo URL out of the JSON:API relationships.logo.data.sizes graph.
function resolveLogo(node: JsonApiNode<ApiChannelAttrs>): string {
  try {
    const sizes = node.relationships.logo.data.relationships.sizes.data;
    const pick = sizes["100x100"] || sizes["100x80"] || sizes["original"];
    return (pick && pick.attributes && pick.attributes.url) || "";
  } catch (e) {
    return "";
  }
}

function deriveDvr(a: ApiChannelAttrs): DvrWindow | null {
  const dur = a.recordingDuration;
  if (!dur || dur <= 0 || a.rewindAllowed === false) return null;
  // Window start ≈ now - duration; refined by getDvrGaps when the timeline opens (US3).
  return { startsAt: Math.floor(Date.now() / 1000) - dur, durationSec: dur };
}

export function transformChannel(node: JsonApiNode<ApiChannelAttrs>): Channel {
  const a = node.attributes;
  const dvrWindow = deriveDvr(a);
  return {
    id: String(node.id),
    slug: a.slug,
    number: a.sort || 0,
    name: a.name || a.slug,
    logoUrl: resolveLogo(node),
    categoryIds: [], // category not exposed on the channel list view (filter is P3)
    hasCatchup: dvrWindow != null,
    dvrWindow,
    nowTitle: null, // populated from EPG in US2
  };
}

export function transformChannels(nodes: JsonApiNode<ApiChannelAttrs>[]): Channel[] {
  return (nodes || [])
    .filter((n) => n.attributes && n.attributes.status === "enabled")
    .map(transformChannel)
    .sort((a, b) => a.number - b.number);
}

// Categories are not in the channel list payload yet; return empty until a
// category feed is wired (FR-013, P3).
export function deriveCategories(_channels: Channel[]): Category[] {
  return [];
}
