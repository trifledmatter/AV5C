"use client";

import React, { useState } from "react";
import { DndContext, useDraggable } from "@dnd-kit/core";
import { Resizable } from "react-resizable";
import "react-resizable/css/styles.css";
import {
  useWorkflowManagerContext,
  WorkflowManagerProvider,
} from "./_hooks/useWorkflowManager";
// import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// import axios from "axios";

type Position = {
  x: number;
  y: number;
};

type Size = {
  width: number;
  height: number;
};

const DraggableResizableBox = ({
  id,
  title,
  className,
  defaultPosition,
  defaultSize,
  children,
  onDragEnd,
  onResizeEnd,
  minWidth = 100,
  minHeight = 50,
  maxWidth = 800,
  maxHeight = 600,
}: {
  id: string;
  title: string;
  className?: string;
  defaultPosition: Position;
  defaultSize: Size;
  children: React.ReactNode;
  onDragEnd: (id: string, position: Position) => void;
  onResizeEnd: (id: string, size: Size) => void;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}) => {
  const [position, setPosition] = useState(defaultPosition);
  const [size, setSize] = useState(defaultSize);
  const [isSelected, setIsSelected] = useState(false);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
    disabled: isSelected,
  });

  const handleDragEnd = () => {
    if (transform) {
      const newPosition = {
        x: position.x + transform.x,
        y: position.y + transform.y,
      };
      setPosition(newPosition);
      onDragEnd(id, newPosition);
    }
  };

  const handleResize = (event: React.SyntheticEvent, data: { size: Size }) => {
    setSize(data.size);
  };

  const handleResizeStop = (
    event: React.SyntheticEvent,
    data: { size: Size }
  ) => {
    setSize(data.size);
    onResizeEnd(id, data.size);
  };

  const handleDoubleClick = () => {
    setIsSelected(true);
  };

  const handleClick = () => {
    setIsSelected(false);
  };

  const style = {
    transform: transform
      ? `translate3d(${position.x + transform.x}px, ${
          position.y + transform.y
        }px, 0)`
      : `translate3d(${position.x}px, ${position.y}px, 0)`,
    boxShadow: isSelected ? "0 0 10px 2px rgba(255, 255, 0, 0.8)" : "none",
    borderRadius: "1rem",
    cursor: isSelected ? "nwse-resize" : "grab",
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...(!isSelected && listeners)}
        {...attributes}
        onPointerUp={handleDragEnd}
        onDoubleClick={handleDoubleClick}
        onClick={handleClick}
        className={"absolute " + className || ""}
      >
        {isSelected ? (
          <Resizable
            width={size.width}
            height={size.height}
            onResize={handleResize}
            onResizeStop={handleResizeStop}
            minConstraints={[minWidth, minHeight]}
            maxConstraints={[maxWidth, maxHeight]}
            resizeHandles={["se"]}
          >
            <div
              style={{ width: size.width, height: size.height }}
              className="flex h-full w-full overflow-scroll rounded-2xl border-2 border-dashed border-white bg-black p-8"
            >
              <p className="fixed left-0 top-0 -translate-y-8">{title}</p>
              {children}
            </div>
          </Resizable>
        ) : (
          <div
            style={{ width: size.width, height: size.height }}
            className="flex h-full w-full overflow-scroll rounded-2xl border-2 border-dashed border-white bg-black p-8"
          >
            <p className="fixed left-0 top-0 -translate-y-8">{title}</p>
            {children}
          </div>
        )}
      </div>
    </>
  );
};

const Home: React.FC = () => {
  const [source, setSource] = useState<string>("localhost");

  const {
    commands,
    logs,
    // isRunning,
    isCameraOnline = false,
    isVexOnline = false,
    // liveFeed,
    startWorkflow,
    stopWorkflow,
    sendCommand,
    setGoal: sendGoal,
    cameraSrc,
    // fetchWorkflowState,
  } = useWorkflowManagerContext({ source_ip: "localhost" });

  const [command, setCommand] = useState<string>("");
  const [goal, setGoal] = useState<string>("");

  const [positions, setPositions] = useState<Record<string, Position>>({
    "live-view": { x: 50, y: 50 },
    "control-vex": { x: 50, y: 500 },
    "config-ip": { x: 500, y: 500 },
    "set-goal": { x: 50, y: 700 },
    logs: { x: 50, y: 900 },
    "command-history": { x: 400, y: 900 },
    footer: { x: 300, y: 700 },
  });

  const [sizes, setSizes] = useState<Record<string, Size>>({
    "live-view": { width: 640, height: 480 },
    "control-vex": { width: 275, height: 150 },
    "config-ip": { width: 275, height: 250 },
    "set-goal": { width: 275, height: 150 },
    logs: { width: 300, height: 200 },
    "command-history": { width: 300, height: 200 },
    footer: { width: 400, height: 100 },
  });

  const handleDragEnd = (id: string, position: Position) => {
    setPositions((prev) => ({
      ...prev,
      [id]: position,
    }));
  };

  //   const handleResizeEnd = (id: string, size: Size) => {
  //     setSizes((prev) => ({
  //       ...prev,
  //       [id]: size,
  //     }));
  //   };

  return (
    <DndContext>
      <div className="relative h-screen w-screen overflow-hidden bg-black text-white">
        {/* Live View */}
        <DraggableResizableBox
          id="live-view"
          title={`Live View (${sizes["live-view"]?.width}x${sizes["live-view"]?.height})`}
          defaultPosition={positions["live-view"]!}
          defaultSize={sizes["live-view"]!}
          onDragEnd={handleDragEnd}
          onResizeEnd={(id, size) => {
            setSizes((prev) => ({
              ...prev,
              [id]: size,
            }));
          }}
          minWidth={640}
          minHeight={480}
          maxHeight={1200}
          maxWidth={1920}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cameraSrc} // interpret the new camera url
            alt="Live Feed"
            width={640}
            height={480}
            className="flex h-full w-full object-contain"
          />
        </DraggableResizableBox>

        {/* Configure the connection IP */}
        <DraggableResizableBox
          id="config-ip"
          title={`Configuration (${sizes["config-ip"]?.width}x${sizes["config-ip"]?.height})`}
          defaultPosition={positions["config-ip"]!}
          defaultSize={sizes["config-ip"]!}
          onDragEnd={handleDragEnd}
          onResizeEnd={(id, size) => {
            setSizes((prev) => ({
              ...prev,
              [id]: size,
            }));
          }}
          minHeight={250}
          maxHeight={250}
        >
          <div className="flex w-full flex-col space-y-2">
            <Input
              placeholder="Set Source IP..."
              className="bg-transparent"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                console.log(e.target.value);
              }}
            />
            <Button
              onClick={() => {
                setSource(source + " ");
              }}
              className="bg-white text-black hover:bg-white/90"
            >
              Insert Space
            </Button>
            {/* <Button
              onClick={() => {
                if (source.length >= 7) {
                  setSource(source);
                }
              }}
              className="bg-white text-black hover:bg-white/90"
            >
              Set Source
            </Button>
            <Button
              onClick={() => {
                if (camSource.length >= 7) {
                  setCamSource(camSource);
                }
              }}
              className="bg-white text-black hover:bg-white/90"
            >
              Set Camera Source
            </Button> */}
          </div>
        </DraggableResizableBox>

        {/* Control the VEX */}
        <DraggableResizableBox
          id="control-vex"
          title={`Control VEX (${sizes["control-vex"]?.width}x${sizes["control-vex"]?.height})`}
          defaultPosition={positions["control-vex"]!}
          defaultSize={sizes["control-vex"]!}
          onDragEnd={handleDragEnd}
          onResizeEnd={(id, size) => {
            setSizes((prev) => ({
              ...prev,
              [id]: size,
            }));
          }}
          minHeight={150}
          maxHeight={250}
        >
          <div className="flex w-full flex-col space-y-2">
            <Input
              placeholder="Send a command..."
              className="bg-transparent"
              value={command}
              onChange={(e) => {
                setCommand(e.target.value);
                console.log(e.target.value);
              }}
            />
            <Button
              onClick={() => {
                setSource(source + " ");
              }}
              className="bg-white text-black hover:bg-white/90"
            >
              Insert Space
            </Button>
            <Button
              onClick={() => {
                if (command.length >= 7) {
                  sendCommand(command);
                }
              }}
              className="bg-white text-black hover:bg-white/90"
            >
              Execute
            </Button>
          </div>
        </DraggableResizableBox>

        {/* Set Goals */}
        <DraggableResizableBox
          id="set-goal"
          title={`Set Goals (${sizes["set-goal"]?.width}x${sizes["set-goal"]?.height})`}
          defaultPosition={positions["set-goal"]!}
          defaultSize={sizes["set-goal"]!}
          onDragEnd={handleDragEnd}
          onResizeEnd={(id, size) => {
            setSizes((prev) => ({
              ...prev,
              [id]: size,
            }));
          }}
          minHeight={150}
          maxHeight={250}
        >
          <div className="flex w-full flex-col space-y-2">
            <Input
              placeholder="Enter a new goal..."
              className="bg-transparent"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
            <Button
              onClick={() => {
                setSource(source + " ");
              }}
              className="bg-white text-black hover:bg-white/90"
            >
              Insert Space
            </Button>
            <Button
              onClick={() => {
                if (command.length >= 7) {
                  sendGoal(generateUUID(), command);
                }
              }}
              className="bg-white text-black hover:bg-white/90"
            >
              Set New Goal
            </Button>
          </div>
        </DraggableResizableBox>

        {/* Logs */}
        <DraggableResizableBox
          id="logs"
          title={`Logs (${sizes.logs?.width}x${sizes.logs?.height})`}
          defaultPosition={positions.logs!}
          defaultSize={sizes.logs!}
          onDragEnd={handleDragEnd}
          onResizeEnd={(id, size) => {
            setSizes((prev) => ({
              ...prev,
              [id]: size,
            }));
          }}
        >
          <div className="flex w-full flex-col space-y-3">
            {logs.map((log, index) => (
              <div key={index} className="flex flex-col space-y-2">
                <div className="flex space-x-4">
                  <p className="opacity-60">{index}</p>
                  <p>{log}</p>
                </div>
                <hr className="border border-white/10" />
              </div>
            ))}
          </div>
        </DraggableResizableBox>

        {/* Command History */}
        <DraggableResizableBox
          id="command-history"
          title={`Command Queue (${sizes["command-history"]?.width}x${sizes["command-history"]?.height})`}
          defaultPosition={positions["command-history"]!}
          defaultSize={sizes["command-history"]!}
          onDragEnd={handleDragEnd}
          onResizeEnd={(id, size) => {
            setSizes((prev) => ({
              ...prev,
              [id]: size,
            }));
          }}
        >
          <div className="flex w-full flex-col space-y-3">
            {commands.map((command, index) => (
              <div key={index} className="flex flex-col space-y-2">
                <div className="flex space-x-4">
                  <p className="opacity-60">{index}</p>
                  <p>{command.command}</p>
                </div>
                <hr className="border border-white/10" />
              </div>
            ))}
          </div>
        </DraggableResizableBox>

        {/* Bottom Left Buttons */}
        <div className="absolute bottom-4 left-4 flex space-x-4">
          <button
            className="flex size-8 items-center justify-center rounded bg-white text-white hover:bg-white/80"
            onClick={async () => void startWorkflow()}
          >
            <svg
              width="15"
              height="15"
              className="scale-16 invert"
              viewBox="0 0 15 15"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3.24182 2.32181C3.3919 2.23132 3.5784 2.22601 3.73338 2.30781L12.7334 7.05781C12.8974 7.14436 13 7.31457 13 7.5C13 7.68543 12.8974 7.85564 12.7334 7.94219L3.73338 12.6922C3.5784 12.774 3.3919 12.7687 3.24182 12.6782C3.09175 12.5877 3 12.4252 3 12.25V2.75C3 2.57476 3.09175 2.4123 3.24182 2.32181ZM4 3.57925V11.4207L11.4288 7.5L4 3.57925Z"
                fill="currentColor"
                fillRule="evenodd"
                clipRule="evenodd"
              ></path>
            </svg>
          </button>
          <button
            className="flex size-8 items-center justify-center rounded bg-white text-white hover:bg-white/80"
            onClick={async () => void stopWorkflow()}
          >
            <svg
              width="15"
              height="15"
              className="scale-16 invert"
              viewBox="0 0 15 15"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6.04995 2.74998C6.04995 2.44623 5.80371 2.19998 5.49995 2.19998C5.19619 2.19998 4.94995 2.44623 4.94995 2.74998V12.25C4.94995 12.5537 5.19619 12.8 5.49995 12.8C5.80371 12.8 6.04995 12.5537 6.04995 12.25V2.74998ZM10.05 2.74998C10.05 2.44623 9.80371 2.19998 9.49995 2.19998C9.19619 2.19998 8.94995 2.44623 8.94995 2.74998V12.25C8.94995 12.5537 9.19619 12.8 9.49995 12.8C9.80371 12.8 10.05 12.5537 10.05 12.25V2.74998Z"
                fill="currentColor"
                fillRule="evenodd"
                clipRule="evenodd"
              ></path>
            </svg>
          </button>
        </div>

        {/* Bottom Right Div */}
        <div className="absolute bottom-4 right-4 flex justify-between space-x-20 rounded border border-b-4 border-r-4 border-white bg-black px-6 py-4 text-white">
          <span className="text-xl">VEX Software</span>
          <div className="flex items-center gap-x-4">
            <span className="italic opacity-80">
              {isVexOnline && isCameraOnline
                ? "All systems operational"
                : isVexOnline || isCameraOnline
                  ? "Some systems operational"
                  : "No systems online"}
            </span>

            {isVexOnline && isCameraOnline ? (
              <div className="size-3 rounded-full bg-green-400" />
            ) : isVexOnline || isCameraOnline ? (
              <div className="size-3 rounded-full bg-orange-400" />
            ) : (
              <div className="size-3 rounded-full bg-red-400" />
            )}
          </div>
        </div>
      </div>
    </DndContext>
  );
};

const App = () => (
  <WorkflowManagerProvider>
    <Home />
  </WorkflowManagerProvider>
);

export default App;
