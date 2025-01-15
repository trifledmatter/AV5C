export interface Command {
  command: string;
  status: string;
  timeLeft?: string;
}

export interface Status {
  cameraOnline: boolean;
}

// API Responses
export interface APILogEntry {
  level: string;
  message: string;
}

export interface APIGoalSubmission {
  goal_id: string;
  goal_request: string;
}
export interface APIExecutionRequest {
  command: string;
}
export interface APILogsRequest {
  level?: string;
}
export interface APICameraResponse {
  src: string;
  status: APIDeviceStatus;
}
export interface APIGoalsResponse {
  goals: object[];
}
export interface APILogsResponse {
  logs: APILogEntry[];
}
export interface APIExecutionResponse {
  command: string;
  response: string;
}
export interface APIDeviceStatus {
  isOnline: boolean;
}
export interface APIServiceStatus {
  running: boolean;
  goal: string | null;
  command_executed: number;
  log_size: number;
}
export interface APIServerErrorResponse {
  where: string;
  hasError: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: Record<string, any>;
}

export interface APIServerDataResponse<T> {
  success: boolean;
  data?: T | null;
}

export interface APIResponse<T> {
  error?: APIServerErrorResponse | null;
  status: number;
  message?: string | null;
  response: APIServerDataResponse<T>;
  timestamp: string;
}
