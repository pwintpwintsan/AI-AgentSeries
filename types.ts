
export interface Message {
  role: 'user' | 'assistant';
  text: string;
}

export interface UserStats {
  accumulatedTimeMs: number;
  isPaid: boolean;
  registrationDate?: string;
}

export enum ConnectionStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  ACTIVE = 'ACTIVE',
  ERROR = 'ERROR'
}
