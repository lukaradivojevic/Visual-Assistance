from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from memory_folder.user_memory import add_memory, load_user_memory, find_familiar_memory
from vision_agent import analyze_image, VALID_MODES
from logger import log_request
from typing import Optional

app = FastAPI(title="Visual Assistance Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CameraRequest(BaseModel):
    image: str
    mode: str = "general"

class MemoryRequest(BaseModel):
    text: str
    category: str = "general"
    image: Optional[str] = None

class FamiliarRequest(BaseModel):
    image: str
    category: Optional[str] = None

@app.get("/")
@app.get("/api/")
def home():
    return {"message": "Visual Assistance backend is running"}

@app.get("/modes")
@app.get("/api/modes")
def get_modes():
    return {
        "available_modes": VALID_MODES
    }

@app.post("/api/analyze-camera")
@app.post("/analyze-camera")
def analyze_camera(request: CameraRequest):
    if not request.image:
        error_message = "Image is missing."
        log_request(
            mode=request.mode,
            success=False,
            error=error_message
        )

        return {
            "success": False,
            "description": "",
            "error": error_message
        }

    if request.mode not in VALID_MODES:
        error_message = f"Invalid mode. Available modes are: {VALID_MODES}"
        log_request(
            mode=request.mode,
            success=False,
            error=error_message
        )

        return {
            "success": False,
            "description": "",
            "error": error_message
        }

    try:
        description = analyze_image(request.image, request.mode)
    except Exception as e:
        error_message = f"AI analysis failed: {str(e)}"
        log_request(
            mode=request.mode,
            success=False,
            error=error_message
        )

        return {
            "success": False,
            "description": "",
            "error": error_message
        }

    log_request(
        mode=request.mode,
        success=True,
        description=description
    )

    return {
        "success": True,
        "description": description,
        "mode": request.mode
    }

@app.post("/memory/add")
def add_user_memory(request: MemoryRequest):
    if not request.text.strip():
        return {
            "success": False,
            "error": "Memory text cannot be empty."
        }

    memory = add_memory(
        text=request.text.strip(),
        category=request.category,
        image_base64=request.image
    )

    return {
        "success": True,
        "message": "Memory saved successfully.",
        "memory": memory
    }

@app.post("/memory/familiar")
def check_familiar_memory(request: FamiliarRequest):
    if not request.image:
        return {
            "success": False,
            "familiar": False,
            "description": "",
            "error": "Image is missing."
        }

    try:
        result = find_familiar_memory(
            request.image,
            category_filter=request.category
        )

        log_request(
            mode="familiar",
            success=result.get("success", True),
            description=result.get("description", ""),
            error=result.get("error")
        )

        return result

    except Exception as e:
        error_message = f"Familiar memory check failed: {str(e)}"

        log_request(
            mode="familiar",
            success=False,
            error=error_message
        )

        return {
            "success": False,
            "familiar": False,
            "description": "",
            "error": error_message
        }

@app.get("/memory")
def get_memory():
    return {
        "success": True,
        "memory": load_user_memory()
    }