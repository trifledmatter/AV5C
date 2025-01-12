from pydantic import BaseModel


class LogEntry(BaseModel):
    level: str
    message: str


class GoalSubmission(BaseModel):
    goal_id: str
    goal_request: str
