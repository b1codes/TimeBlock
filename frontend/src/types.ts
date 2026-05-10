export interface Task {
  task_id: string;
  title: string;
  duration_minutes: number;
  min_duration: number;
}

export interface TimeChunk {
  user_id: string;
  chunk_id: string;
  title: string;
  start_time: string; // ISO string
  end_time: string;   // ISO string
  is_template: boolean;
  tasks: Task[];
}
