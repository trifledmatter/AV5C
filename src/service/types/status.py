from pydantic import BaseModel

class DeviceStatus(BaseModel):
    isOnline: bool


class ServiceStatus(BaseModel):
    running: bool
    goal: str | None
    commands_executed: int
    log_size: int
