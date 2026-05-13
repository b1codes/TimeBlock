import debounce from 'lodash/debounce';
import type { DebouncedFunc } from 'lodash';
import { Task, TimeChunk } from '../types';

export type ChunkUpdate = {
  tasks?: Task[];
  start_time?: string;
  end_time?: string;
};

export class ApiClient {
  private baseUrl: string;
  private userId: string;

  constructor(baseUrl: string, userId: string) {
    this.baseUrl = baseUrl;
    this.userId = userId;

    this.sendPatch = this.sendPatch.bind(this);
    this.debouncedUpdateChunk = debounce(this.sendPatch, 750);
  }

  public async getChunks(): Promise<TimeChunk[]> {
    const response = await fetch(`${this.baseUrl}/chunks/`, {
      headers: { 'x-user-id': this.userId },
    });
    if (!response.ok) throw new Error('Failed to fetch chunks');
    return response.json();
  }

  public async getTemplates(): Promise<TimeChunk[]> {
    const response = await fetch(`${this.baseUrl}/templates/`, {
      headers: { 'x-user-id': this.userId },
    });
    if (!response.ok) throw new Error('Failed to fetch templates');
    return response.json();
  }

  public async createChunk(params: {
    title: string;
    start_time: string;
    end_time: string;
    template_id?: string;
  }): Promise<TimeChunk> {
    const response = await fetch(`${this.baseUrl}/chunks/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': this.userId,
      },
      body: JSON.stringify(params),
    });
    if (!response.ok) throw new Error('Failed to create chunk');
    return response.json();
  }

  public async deleteChunk(chunkId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/chunks/${chunkId}/`, {
      method: 'DELETE',
      headers: { 'x-user-id': this.userId },
    });
    if (!response.ok) throw new Error('Failed to delete chunk');
  }

  private async sendPatch(chunkId: string, payload: ChunkUpdate): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/chunks/${chunkId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': this.userId,
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Failed to sync chunk', error);
    }
  }

  public debouncedUpdateChunk: DebouncedFunc<(chunkId: string, payload: ChunkUpdate) => Promise<void>>;
}
