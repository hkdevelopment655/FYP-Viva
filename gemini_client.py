"""
Gemini AI Client — shared utility for all AI service routes.
Import this wherever you need Gemini in Python.

Usage:
    from utils.gemini_client import ask_gemini_sync, ask_gemini_async, describe_image, analyze_outfit
"""
import os
import io
import json
import base64
import PIL.Image
import google.generativeai as genai

# ── Singleton model instance ─────────────────────────────────────────────────
_model = None

def get_model(model_name: str = "gemini-3.1-flash-lite"):
    """Return cached Gemini model, initializing on first call."""
    global _model
    if _model is not None:
        return _model

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or api_key == "your_gemini_key_here":
        raise ValueError("GEMINI_API_KEY not set in ai-service/.env")

    genai.configure(api_key=api_key)

    _model = genai.GenerativeModel(
        model_name=model_name,
        generation_config=genai.types.GenerationConfig(
            max_output_tokens=1024,
            temperature=0.75,
            top_p=0.9,
        )
    )
    print(f"✅ Gemini model initialized: {model_name}")
    return _model


def ask_gemini_sync(prompt: str, system: str = "", history: list = []) -> str:
    """
    Synchronous Gemini call — use in regular Python functions.
    """
    model = get_model()
    formatted_history = []
    for h in history:
        role = "model" if h.get("role") in ["assistant", "model"] else "user"
        parts = h.get("parts")
        if parts:
            # support lists
            if isinstance(parts, list):
                text = parts[0].get("text", "") if isinstance(parts[0], dict) else str(parts[0])
            else:
                text = str(parts)
        else:
            text = h.get("content", "")
        formatted_history.append({"role": role, "parts": [text]})

    chat = model.start_chat(history=formatted_history)
    full_prompt = f"{system}\n\n{prompt}" if system and not history else prompt
    response = chat.send_message(full_prompt)
    return response.text


async def ask_gemini_async(prompt: str, system: str = "", history: list = []) -> str:
    """
    Async Gemini call — use inside FastAPI async endpoints.
    """
    model = get_model()
    formatted_history = []
    for h in history:
        role = "model" if h.get("role") in ["assistant", "model"] else "user"
        parts = h.get("parts")
        if parts:
            if isinstance(parts, list):
                text = parts[0].get("text", "") if isinstance(parts[0], dict) else str(parts[0])
            else:
                text = str(parts)
        else:
            text = h.get("content", "")
        formatted_history.append({"role": role, "parts": [text]})

    chat = model.start_chat(history=formatted_history)
    full_prompt = f"{system}\n\n{prompt}" if system and not history else prompt
    response = await chat.send_message_async(full_prompt)
    return response.text


def describe_image(image_bytes: bytes, prompt: str) -> str:
    """
    Gemini Vision — analyze an image with a text prompt.
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")

    genai.configure(api_key=api_key)
    vision_model = genai.GenerativeModel("gemini-3.1-flash-lite")
    img = PIL.Image.open(io.BytesIO(image_bytes)).convert("RGB")
    response = vision_model.generate_content([prompt, img])
    return response.text


def analyze_outfit(image_bytes: bytes) -> dict:
    """
    Analyze uploaded clothing item — returns color, style, category, description.
    """
    prompt = """Analyze this clothing item and respond ONLY with JSON:
{
  "color": "primary color of the garment",
  "style": "casual|formal|semi-formal|sportswear|ethnic",
  "category": "shirts|pants|shoes|watches|accessories|jackets|dresses",
  "description": "one sentence description"
}"""
    try:
        raw = describe_image(image_bytes, prompt)
        clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        return json.loads(clean)
    except Exception as e:
        print(f"Outfit analysis error: {e}")
        return {
            "color": "unknown",
            "style": "casual",
            "category": "shirts",
            "description": "Fashion item"
        }
