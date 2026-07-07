from typing import Generic, Optional, TypeVar
from pydantic import BaseModel

DataType = TypeVar("DataType")


class ResponseEnvelope(BaseModel, Generic[DataType]):
    """
    Uniform response envelope for all endpoints:
    { "success": bool, "data": any | null, "error": str | None }
    """

    success: bool
    data: Optional[DataType] = None
    error: Optional[str] = None
