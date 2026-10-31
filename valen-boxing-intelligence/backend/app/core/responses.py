import math
from typing import Any, Optional
from fastapi import Request
from fastapi.responses import JSONResponse


def success_response(data: Any, meta: Optional[dict] = None) -> dict:
    return {"data": data, "meta": meta}


def paginated_response(data: list, page: int, page_size: int, total: int) -> dict:
    total_pages = max(1, math.ceil(total / page_size)) if page_size > 0 else 1
    return {
        "data": data,
        "meta": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
        },
    }


def error_response(code: str, message: str, details: Any = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details}}


async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=error_response(
            code="INTERNAL_ERROR",
            message="An unexpected error occurred",
        ),
    )
