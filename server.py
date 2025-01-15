from typing import Any, List, Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import requests
from src.service.util import CameraStore, process_env

from service import ServiceManager
from src.dev.camera import Camera
from src.service.types.misc import GoalSubmission, LogEntry
from src.service.types.request import ExecutionRequest, LogsRequest
from src.service.types.response import (
    CameraResponse,
    ExecutionResponse,
    GoalResponse,
    LogsResponse,
)
from src.service.types.status import DeviceStatus, ServiceStatus

from src.dev.actor import Actor
from src.dev.brain import BaseBrain

from src.dev.gen import CommandGenerator
from src.dev.goal import Goals
from src.service.response import Response, ServerError, ServerResponse

from src.dev.reporting import Reporter
from src.dev.device import DeviceManager


camera_src = f"http://{process_env("CAMERA_SOURCE", "10.0.0.74")}:4747/video"

app = FastAPI()

log = Reporter()
brain = BaseBrain()

actor = Actor(reporter=log)

gen = CommandGenerator(brain, reporter=log)
goals = Goals(brain, reporter=log)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

storage = CameraStore()
camera = Camera(reporter=log, stream_url=camera_src, store=storage)
service_manager = ServiceManager(reporter=log, goals=goals, camera=camera)


@app.get("/dev/vex/status")
def dev_vex_status() -> Response[Any]:
    from serial.serialutil import SerialException

    device_connected: bool = False

    try:
        DeviceManager(reporter=log)
        device_connected = True
    except:
        device_connected = False

    if not device_connected:
        return ServerError("device connection check", {"error": "VEX OFFLINE"})

    try:
        dev = DeviceManager(reporter=log)

        dev.send_command("vex ping")
        response = dev.current_response

        online = response is not None

        item = DeviceStatus(isOnline=online)
        return ServerResponse(item)
    except SerialException:
        return ServerError("accessing vex device", {"error": "VEX OFFLINE"})


@app.get("/dev/vex/start")
def dev_vex_start() -> Response[ServiceStatus] | Response[None]:
    device_connected: bool = False

    try:
        DeviceManager(reporter=log)
        device_connected = True
    except:
        device_connected = False

    if not device_connected:
        return ServerError("device connection check", {"error": "VEX OFFLINE"})

    if service_manager.state.running:
        return ServerError("service run check", {"error": "Service is already running"})

    service_manager.start_service()
    log.log_custom("SERVICE", message="Service Started")

    return ServerResponse(
        ServiceStatus(
            running=service_manager.state.running,
            goal=service_manager.state.goal,
            commands_executed=service_manager.state.commands_executed,
            log_size=service_manager.state.log_size,
        )
    )


@app.get("/dev/vex/stop")
def dev_vex_stop() -> Response[ServiceStatus] | Response[None]:
    if not service_manager.state.running:
        return ServerError("service run check", {"error": "Service is not running"})

    service_manager.stop_service()
    log.log_custom("SERVICE", message="Service Stopped")

    return ServerResponse(
        ServiceStatus(
            running=service_manager.state.running,
            goal=service_manager.state.goal,
            commands_executed=service_manager.state.commands_executed,
            log_size=service_manager.state.log_size,
        )
    )


@app.post("/dev/vex/execute")
def dev_vex_execute(
    command: ExecutionRequest,
) -> Response[ExecutionResponse] | Response[None]:
    global service_commands_ran

    try:
        device = DeviceManager()

        device.send_command(command.command)
        response = device.current_response

        if response and isinstance(response, str):
            return ServerResponse(
                ExecutionResponse(command=command.command, response=response)
            )

        service_manager.commands_ran.append(command.command)
        log.log_custom("EXECUTE", command.command)

        return ServerResponse(
            ExecutionResponse(command=command.command, response="No response")
        )
    except:
        return ServerError("initializing device", {"error": "vex not connected"})


@app.get("/dev/camera")
def dev_camera() -> Response[Any]:
    try:
        latest_frame = storage.get_frame(camera_src)

        if latest_frame is None:
            return ServerError(
                where="fetch camera frame",
                details={"error": "No frame available from the camera stream."},
            )

        r = requests.get(camera_src, stream=True, timeout=1)
        status = DeviceStatus(isOnline=r.status_code >= 200 and r.status_code < 300)

        data = CameraResponse(
            src=latest_frame,
            status=status,
        )
        return ServerResponse(data)

    except Exception as e:
        print("Something happened:", e)
        return ServerError(
            where="fetch camera frame",
            details={"error": f"An error occurred: {str(e)}"},
        )


@app.get("/dev/camera/status")
def dev_camera_status() -> Response[Any]:
    try:
        r = requests.get(camera_src, timeout=1, stream=True)

        data = DeviceStatus(isOnline=r.status_code >= 200 and r.status_code < 300)
        return ServerResponse(data, deprecated=True)
    except:
        return ServerResponse(DeviceStatus(isOnline=False), deprecated=True)


@app.get("/service/goal")
def service_get_goal() -> Response[GoalResponse]:
    all_goals = goals.list_goals()

    if all_goals:
        return ServerResponse(
            GoalResponse(
                goals=all_goals,
                current_goal=all_goals[0],
                next_goal=all_goals[1] if len(all_goals) > 1 else None,
                goals_size=len(all_goals),
            )
        )

    return ServerResponse(
        GoalResponse(
            goals=[],
            current_goal=None,
            next_goal=None,
            goals_size=0,
        )
    )


@app.post("/service/goal")
def service_create_goal(goal: GoalSubmission) -> Response[str]:

    goal_data = goal.model_dump()
    new_goal = goals.create_goal(
        goal_id=goal_data["goal_id"], goal_text=goal_data["goal_request"]
    )
    submission_result = goals.submit_goal(new_goal)
    goals.reporter.log_custom(
        "GOAL", message=f"Added goal '{goal_data["goal_request"]}'"
    )

    return ServerResponse(submission_result)


@app.delete("/service/goal")
def service_clear_goals() -> Response[str]:
    global service_current_goal
    with goals.goal_queue.mutex:
        goals.goal_queue.queue.clear()

    goals.reporter.log_custom("GOAL", message="All goals cleared")

    service_manager.state.goal = None
    return ServerResponse("All goals cleared")


@app.get("/service/logs")
def service_get_logs(req: Optional[LogsRequest] = None) -> Response[LogsResponse]:
    if req:
        log_entries = log.get_logs(req.level)
    else:
        log_entries = log.get_logs()

    logs = [LogEntry(level=log["level"], message=log["message"]) for log in log_entries]

    return ServerResponse(LogsResponse(logs=logs, logs_count=len(logs)))


@app.get("/service/commands")
def service_get_executed_command() -> Response[List[str]]:
    return ServerResponse(service_manager.commands_ran)


@app.get("/service/status")
def service_get_status() -> Response[ServiceStatus]:
    global service_commands_ran, service_running, service_current_goal

    return ServerResponse(
        ServiceStatus(
            running=service_manager.state.running,
            goal=service_manager.state.goal,
            commands_executed=service_manager.state.commands_executed,
            log_size=service_manager.state.log_size,
        )
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=4000, reload=True)
