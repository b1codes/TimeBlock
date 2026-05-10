import debounce from 'lodash/debounce';
import { Task } from '../types';

export class ApiClient {
  private baseUrl: string;
  private userId: string;

  constructor(baseUrl: string, userId: string) {
    this.baseUrl = baseUrl;
    this.userId = userId;
    
    // Bind the method so `this` context is preserved in the debounced function
    this.executePatch = this.executePatch.bind(this);
    
    // Spec: Debounce payload dispatch by a minimum of 750ms
    this.debouncedUpdateChunkTasks = debounce(this.executePatch, 750);
  }

  private async executePatch(chunkId: string, tasks: Task[]): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/chunks/${chunkId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': this.userId
        },
        // Spec: Batch Payload - expect entire modified array in single JSON payload
        body: JSON.stringify({ tasks })
      });
    } catch (error) {
      console.error('Failed to sync tasks', error);
    }
  }

  // The public debounced method
  public debouncedUpdateChunkTasks: (chunkId: string, tasks: Task[]) => void;
}
