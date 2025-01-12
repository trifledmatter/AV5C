from typing import List
from pydantic import BaseModel

from .misc import LogEntry
from .status import DeviceStatus


class CameraResponse(BaseModel):
    src: str
    status: DeviceStatus


class GoalResponse(BaseModel):
    goals: List[dict[str, str]] | None
    next_goal: dict[str, str] | None
    goals_size: int
    current_goal: dict[str, str] | None


class LogsResponse(BaseModel):
    logs: List[LogEntry]
    logs_count: int


class ExecutionResponse(BaseModel):
    command: str
    response: str
