VALID_MODES = ["general", "short", "text", "obstacles"]


def build_prompt(mode: str) -> str:
    if mode == "short":
        return (
            "Describe the image in one short sentence. "
            "Mention only the most important information for a blind user."
        )

    if mode == "text":
        return (
            "Read any visible text in the image. "
            "If there is no readable text, say that no clear text is visible."
        )

    if mode == "obstacles":
        return (
            "Focus on obstacles, people, stairs, doors, vehicles, dangerous objects, "
            "and anything important for safe movement."
        )

    return (
        "Describe what is visible in the image for a blind or visually impaired user. "
        "Mention important objects, people, visible text, obstacles, and points of interest. "
        "Keep the description concise and practical."
    )


def analyze_image(image_base64: str, mode: str = "general") -> str:
    if mode not in VALID_MODES:
        mode = "general"

    prompt = build_prompt(mode)

    # Temporary fake response until we connect the real AI vision model.
    return f"FAKE AI RESPONSE [{mode}]: {prompt}"