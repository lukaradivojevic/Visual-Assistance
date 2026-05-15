import base64
from pathlib import Path

import numpy as np
from PIL import Image
from sentence_transformers import SentenceTransformer


BASE_DIR = Path(__file__).resolve().parent
TEMP_IMAGE_PATH = BASE_DIR / "_temp_embedding_image.jpg"

MODEL_NAME = "sentence-transformers/clip-ViT-B-32"

_model = None


def get_model():
    """
    Loads CLIP model only once.
    First run can be slow because the model is downloaded.
    """
    global _model

    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)

    return _model


def base64_to_image(image_base64: str) -> Image.Image:
    """
    Converts base64 image from frontend into PIL image.
    Supports both raw base64 and data:image/jpeg;base64,...
    """
    if not image_base64:
        raise ValueError("Image is missing.")

    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]

    image_bytes = base64.b64decode(image_base64)

    with open(TEMP_IMAGE_PATH, "wb") as file:
        file.write(image_bytes)

    image = Image.open(TEMP_IMAGE_PATH).convert("RGB")

    try:
        TEMP_IMAGE_PATH.unlink()
    except Exception:
        pass

    return image


def create_image_embedding(image_base64: str) -> list[float]:
    """
    Creates normalized image embedding from base64 image.
    This embedding can be stored in user_memory.json.
    """
    image = base64_to_image(image_base64)
    model = get_model()

    embedding = model.encode(image)
    embedding = np.array(embedding, dtype=np.float32)

    norm = np.linalg.norm(embedding)

    if norm > 0:
        embedding = embedding / norm

    return embedding.tolist()


def cosine_similarity(first_embedding: list[float], second_embedding: list[float]) -> float:
    """
    Calculates similarity between two embeddings.
    Result is usually between -1 and 1.
    Higher means more similar.
    """
    first = np.array(first_embedding, dtype=np.float32)
    second = np.array(second_embedding, dtype=np.float32)

    denominator = np.linalg.norm(first) * np.linalg.norm(second)

    if denominator == 0:
        return 0.0

    return float(np.dot(first, second) / denominator)