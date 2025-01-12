from typeguard import typechecked

from datetime import datetime

from pydantic import BaseModel
from typing import Any, Optional, Generic, TypeVar


T = TypeVar("T")


class _ServerErrorResponse(BaseModel):
    where: str
    has_error: bool
    details: Optional[dict[str, Any]]


class _ServerDataResponse(BaseModel, Generic[T]):
    success: bool
    data: Optional[T] | None = None


@typechecked
class Response(BaseModel, Generic[T]):
    error: Optional[_ServerErrorResponse] = None
    status: int
    message: str | None = None
    response: _ServerDataResponse[T]
    timestamp: datetime

    def to_dict(self) -> dict[str, Any]:
        return self.model_dump()

    def to_json(self) -> str:
        return self.model_dump_json()


def ServerResponse(data: T, status: int = 200, deprecated: bool = False) -> Response[T]:
    return Response[T](
        error=None,
        status=status,
        message="This route is deprecated" if deprecated else None,
        response=_ServerDataResponse[T](success=True, data=data),
        timestamp=datetime.now(),
    )


def ServerError(
    where: str, details: Optional[dict[str, Any]] = None, status: int = 400
) -> Response[None]:
    return Response[None](
        error=_ServerErrorResponse(where=where, has_error=True, details=details),
        status=status,
        response=_ServerDataResponse[None](success=False, data=None),
        timestamp=datetime.now(),
    )
