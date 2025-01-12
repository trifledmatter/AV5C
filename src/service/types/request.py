from typing import Optional
from pydantic import BaseModel


class ExecutionRequest(BaseModel):
    command: str


class LogsRequest(BaseModel):
    level: Optional[str] = None
