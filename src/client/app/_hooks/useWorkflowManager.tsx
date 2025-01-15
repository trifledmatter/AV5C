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
import type {
  Command,
  APICameraResponse,
  APIDeviceStatus,
  APIExecutionResponse,
  APILogsResponse,
  APIResponse,
  APIServiceStatus,
} from "../types";
import { axiosInstance, updateAxiosInstance } from "../axiosInstance";

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

      addLog("Workflow stopped.");
    } catch (error) {
      addLog(`Failed to stop workflow: ${error}`);
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
    } catch (error) {
      addLog(`Error starting workflow: ${error}`);
      setIsRunning(false);
    }
  }, [addLog]);

  const fetchWorkflowState = useCallback(async () => {
    try {
      const response =
        await axiosInstance.get<APIResponse<APILogsResponse>>("/service/logs");

      const logsData = response.data.response.data?.logs ?? [];
      logsData.forEach((log) => addLog(`${log.level}: ${log.message}`));
    } catch (error) {
      addLog(`Error fetching workflow state: ${error}`);
    }
  }, [addLog]);

  const checkCameraStatus = useCallback(async () => {
    try {
      const response =
        await axiosInstance.get<APIResponse<APICameraResponse>>("/dev/camera");

      const data = response.data;

      if (data.error?.hasError || !data.response.data?.status.isOnline) {
        setIsCameraOnline(false);
        return;
      }

      setCameraSrc(data?.response.data?.src ?? "/placeholder.jpg");
      setIsCameraOnline(data?.response.data?.status.isOnline ?? false);
    } catch (error) {
      setIsCameraOnline(false);
      addLog(`Error checking camera status: ${error}`);
    }
  }, [addLog]);

  const checkVexStatus = useCallback(async () => {
    try {
      const response =
        await axiosInstance.get<APIResponse<APIDeviceStatus>>(
          "/dev/vex/status"
        );

      const data = response.data;

      if (data.error) {
        setIsVexOnline(false);
        return;
      }

      setIsVexOnline(data.response.data?.isOnline ?? false);
      setIsVexOnline(false);
    } catch (error) {
      setIsVexOnline(false);
      addLog(`Error checking VEX status: ${error}`);
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
        addLog(`Error sending command: ${error}`);
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
        addLog(`Error setting goal: ${error}`);
      }
    },
    [addLog]
  );

  useEffect(() => {
    const statusInterval = setInterval(() => {
      void checkCameraStatus();
      void checkVexStatus();
    }, 20);
    return () => clearInterval(statusInterval);
  }, [checkCameraStatus, checkVexStatus]);

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
  updateAxiosInstance(source_ip);

  const context = useContext(WorkflowManagerContext);
  if (!context) {
    throw new Error(
      "useWorkflowManagerContext must be used within a WorkflowManagerProvider"
    );
  }
  return context;
};
