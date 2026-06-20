import { Observable } from "../lib/observable";
import { silkgoTv } from "../api-clients/SilkgoTvClient";
import { timeService } from "../services/TimeService";
import { transformChannels, deriveCategories } from "../transformers/channelTransformer";
import { Channel, Category } from "../models/channel";

export interface ChannelsState {
  channels: Channel[];
  categories: Category[];
  loading: boolean;
  error: string | null;
}

class ChannelsStore {
  readonly state = new Observable<ChannelsState>({
    channels: [],
    categories: [],
    loading: false,
    error: null,
  });

  // Per-capability load with isolated error state (FR-017).
  async load() {
    this.state.update((s) => ({ ...s, loading: true, error: null }));
    // Server-time sync is best-effort; its failure must not block the channel list.
    try {
      const st = await silkgoTv.getServerTime();
      const a = (st && st.data && st.data.attributes) || ({} as any);
      timeService.syncFrom(a.timestamp || 0, a.dateTime);
    } catch (e) {
      /* tolerate; fall back to device clock */
    }
    try {
      const resp = await silkgoTv.getChannels();
      const channels = transformChannels(resp && resp.data);
      const categories = deriveCategories(channels);
      this.state.set({ channels, categories, loading: false, error: null });
    } catch (e) {
      this.state.update((s) => ({ ...s, loading: false, error: "error.network" }));
    }
  }

  getById(id: string): Channel | undefined {
    return (this.state.value as ChannelsState).channels.filter((c) => c.id === id)[0];
  }

  byNumber(num: number): Channel | undefined {
    return (this.state.value as ChannelsState).channels.filter((c) => c.number === num)[0];
  }

  indexOf(id: string): number {
    const list = (this.state.value as ChannelsState).channels;
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return -1;
  }
}

export const channelsStore = new ChannelsStore();
