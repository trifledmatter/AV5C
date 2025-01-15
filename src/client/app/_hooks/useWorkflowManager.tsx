"use client";

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  type ReactNode,
  useMemo,
} from "react";
import axios from "axios";
import type {
  Command,
  APICameraResponse,
  APIDeviceStatus,
  APIExecutionResponse,
  APILogsResponse,
  APIResponse,
  APIServiceStatus,
} from "../types";

let SOURCE_IP = "10.0.0.74";
const axiosInstance = axios.create({
  baseURL: `http://${SOURCE_IP}:4000`,
});

interface WorkflowManagerContextType {
  commands: Command[];
  logs: string[];
  isRunning: boolean;
  isCameraOnline: boolean;
  isVexOnline: boolean;
  startWorkflow: () => Promise<void>;
  stopWorkflow: () => void;
  sendCommand: (value: string) => Promise<void>;
  setGoal: (goalId: string, goalRequest: string) => Promise<void>;
  fetchWorkflowState: () => Promise<void>;
  cameraSrc: string;
}

const WorkflowManagerContext = createContext<WorkflowManagerContextType | null>(
  null
);

interface WorkflowManagerProviderProps {
  children: ReactNode;
}

export const WorkflowManagerProvider: React.FC<
  WorkflowManagerProviderProps
> = ({ children }) => {
  const [commands, setCommands] = useState<Command[]>([
    { command: "No commands queued.", status: "IDLE" },
  ]);
  const [logs, setLogs] = useState<string[]>(["No logs yet."]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isCameraOnline, setIsCameraOnline] = useState<boolean>(false);
  const [cameraSrc, setCameraSrc] = useState<string>("/placeholder.svg");
  const [isVexOnline, setIsVexOnline] = useState<boolean>(false);

  const addLog = useCallback((log: string) => {
    setLogs((prev) => [...prev, log]);
  }, []);

  const stopWorkflow = useCallback(async () => {
    try {
      await axiosInstance.get<APIResponse<APIServiceStatus>>("/dev/vex/stop");
    } catch (error) {
      addLog(`CLIENT: Failed to stop workflow: ${error}`);
    }
  }, [addLog]);

  const startWorkflow = useCallback(async () => {
    try {
      const response =
        await axiosInstance.get<APIResponse<APIServiceStatus>>(
          "/dev/vex/start"
        );

      const result = response.data.response.data;
      addLog(`Workflow started. Current goal: ${result?.goal}`);
      setCommands(
        result?.command_executed
          ? [{ command: result.goal ?? "Unknown", status: "ACTIVE" }]
          : [{ command: "No actions performed.", status: "IDLE" }]
      );
      setIsRunning(true);
    } catch {
      addLog(`CLIENT: Could not start workflow`);
      setIsRunning(false);
    }
  }, [addLog]);

  const fetchWorkflowState = useCallback(async () => {
    try {
      const response =
        await axiosInstance.get<APIResponse<APILogsResponse>>("/service/logs");

      const logsData = response.data.response.data?.logs ?? [];
      setLogs(logsData.map((log) => `${log.level}: ${log.message}`));
    } catch {
      addLog(`CLIENT: Could not fetch workflow state`);
    }
  }, [addLog]);

  const checkCameraStatus = useCallback(async () => {
    try {
      const response =
        await axiosInstance.get<APIResponse<APICameraResponse>>("/dev/camera");

      const data = response.data.response.data;
      setCameraSrc(data?.src ?? "/placeholder.jpg");
      setIsCameraOnline(data?.status.isOnline ?? false);
    } catch {
      setIsCameraOnline(false);
      addLog(`CLIENT: Could not get camera status`);
    }
  }, [addLog]);

  const checkVexStatus = useCallback(async () => {
    try {
      const response =
        await axiosInstance.get<APIResponse<APIDeviceStatus>>(
          "/dev/vex/status"
        );

      const data = response.data.response.data;
      setIsVexOnline(data?.isOnline ?? false);
    } catch {
      setIsVexOnline(false);
      addLog(`CLIENT: Could not get VEX status`);
    }
  }, [addLog]);

  const sendCommand = useCallback(
    async (command: string) => {
      try {
        const response = await axiosInstance.post<
          APIResponse<APIExecutionResponse>
        >("/dev/vex/execute", { command });

        const commandResponse = response.data.response.data;
        addLog(
          `Sent command: ${command}, Response: ${commandResponse?.response}`
        );
      } catch (error) {
        addLog(`CLIENT: Error sending command: ${error}`);
      }
    },
    [addLog]
  );

  const setGoal = useCallback(
    async (goalId: string, goalRequest: string) => {
      try {
        const response = await axiosInstance.post<APIResponse<string>>(
          "/service/goal",
          {
            goal_id: goalId,
            goal_request: goalRequest,
          }
        );

        const result = response.data.response.data;
        addLog(`Goal set to: ${goalRequest}, Response: ${result}`);
      } catch (error) {
        addLog(`CLIENT: Error setting goal: ${error}`);
      }
    },
    [addLog]
  );

  useEffect(() => {
    const logInterval = setInterval(() => {
      void fetchWorkflowState();
    }, 1000);

    const statusInterval = setInterval(() => {
      void checkCameraStatus();
      void checkVexStatus();
    }, 10);

    return () => {
      clearInterval(logInterval);
      clearInterval(statusInterval);
    };
  }, [fetchWorkflowState, checkCameraStatus, checkVexStatus]);

  const contextValue = useMemo(
    () => ({
      commands,
      logs,
      isRunning,
      isCameraOnline,
      isVexOnline,
      startWorkflow,
      stopWorkflow,
      fetchWorkflowState,
      sendCommand,
      setGoal,
      cameraSrc,
    }),
    [
      commands,
      logs,
      isRunning,
      isCameraOnline,
      isVexOnline,
      startWorkflow,
      stopWorkflow,
      fetchWorkflowState,
      sendCommand,
      setGoal,
      cameraSrc,
    ]
  );

  return (
    <WorkflowManagerContext.Provider value={contextValue}>
      {children}
    </WorkflowManagerContext.Provider>
  );
};

export const useWorkflowManagerContext = ({
  source_ip,
}: {
  source_ip: string;
}) => {
  if (source_ip !== SOURCE_IP) {
    SOURCE_IP = source_ip;
    axiosInstance.defaults.baseURL = `http://${SOURCE_IP}:4000`;
  }

  const context = useContext(WorkflowManagerContext);
  if (!context) {
    throw new Error(
      "useWorkflowManagerContext must be used within a WorkflowManagerProvider"
    );
  }
  return context;
};
