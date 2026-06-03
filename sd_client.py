import os
import json
import httpx
import base64

async def call_sd_api_text2img(
    prompt: str,
    negative_prompt: str = "mutated hands, blurry, bad anatomy",
    width: int = 512,
    height: int = 512,
    samples: int = 1,
    num_inference_steps: int = 30,
    guidance_scale: float = 7.5,
    model_id: str = None
) -> str | None:
    """
    Adapts your Dreambooth code to an async client.
    Generates an image from text and returns it as a Base64 data URI.
    """
    api_key = os.getenv("STABLE_DIFFUSION_API_KEY")
    if not api_key or api_key.startswith("your_"):
        print("⚠️ STABILITY_API_KEY is not set correctly in .env")
        return None

    url = "https://stablediffusionapi.com/api/v4/dreambooth"
    payload = {
        "key": api_key,
        "model_id": model_id or os.getenv("SD_DEFAULT_MODEL", "stable-diffusion-v1-5"),
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "width": str(width),
        "height": str(height),
        "samples": str(samples),
        "num_inference_steps": str(num_inference_steps),
        "guidance_scale": guidance_scale,
        "safety_checker": "yes",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            print(f"🎨 Sending Dreambooth request to StableDiffusionAPI...")
            response = await client.post(url, json=payload, headers={'Content-Type': 'application/json'})
            
            if response.status_code != 200:
                print(f"❌ API Error {response.status_code}: {response.text}")
                return None
                
            data = response.json()
            if data.get("status") == "success" and data.get("output"):
                image_url = data["output"][0]
                # Download the image and encode as base64
                img_res = await client.get(image_url)
                if img_res.status_code == 200:
                    return "data:image/png;base64," + base64.b64encode(img_res.content).decode()
            elif data.get("status") == "processing":
                print("⏳ Generation is queued/processing. (Polling or Webhooks needed for long-running tasks).")
            else:
                print(f"❌ Generation failed: {data.get('message', 'Unknown error')}")
        except Exception as e:
            print(f"❌ Exception in call_sd_api_text2img: {e}")
    return None

