import debounce from 'lodash/debounce';
import { Task, TimeChunk } from '../types';

export class ApiClient {
  private baseUrl: string;
  private userId: string;

  constructor(baseUrl: string, userId: string) {
    this.baseUrl = baseUrl;
    this.userId = userId;
    
    this.executePatch = this.executePatch.bind(this);
    this.debouncedUpdateChunkTasks = debounce(this.executePatch, 750);
  }

  public async getChunks(): Promise<TimeChunk[]> {
    const response = await fetch(`${this.baseUrl}/chunks`, {
      headers: { 'x-user-id': this.userId }
    });
    if (!response.ok) throw new Error('Failed to fetch chunks');
    return response.json();
  }

  public async getTemplates(): Promise<TimeChunk[]> {
    const response = await fetch(`${this.baseUrl}/templates`, {
      headers: { 'x-user-id': this.userId }
    });
    if (!response.ok) throw new Error('Failed to fetch templates');
    return response.json();
  }

  public async createChunk(params: { 
    title: string; 
    start_time: string; 
    end_time: string; 
    template_id?: string 
  }): Promise<TimeChunk> {
    const response = await fetch(`${this.baseUrl}/chunks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': this.userId
      },
      body: JSON.stringify(params)
    });
    if (!response.ok) throw new Error('Failed to create chunk');
    return response.json();
  }

  public async deleteChunk(chunkId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/chunks/${chunkId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': this.userId }
    });
    if (!response.ok) throw new Error('Failed to delete chunk');
  }

  private async executePatch(chunkId: string, tasks: Task[]): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/chunks/${chunkId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': this.userId
        },
        body: JSON.stringify({ tasks })
      });
    } catch (error) {
      console.error('Failed to sync tasks', error);
    }
  }

  public debouncedUpdateChunkTasks: (chunkId: string, tasks: Task[]) => void;
}
