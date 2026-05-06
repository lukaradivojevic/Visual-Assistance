import json
from datetime import datetime


LOG_FILE = "logs.jsonl"


def log_request(mode: str, success: bool, description: str = "", error: str = ""):
    log_data = {
        "timestamp": datetime.now().isoformat(),
        "mode": mode,
        "success": success,
        "description": description,
        "error": error
    }

    with open(LOG_FILE, "a", encoding="utf-8") as file:
        file.write(json.dumps(log_data, ensure_ascii=False) + "\n")