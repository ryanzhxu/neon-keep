import json
from typing import Dict

try:
    import ollama
except ImportError as e:
    raise RuntimeError("The 'ollama' Python package is required. Install with: pip install ollama") from e


class DungeonLogic:
    def __init__(self, model: str = "gpt-oss:20b"):
        self.model = model
        self.system_prompt = (
            "You are the Dungeon Master of a 1-HP roguelike. "
            "Evaluate user actions. Return ONLY JSON matching schema: {\"alive\": boolean, \"story\": string}."
        )
        self.history = [{"role": "system", "content": self.system_prompt}]

    def process_turn(self, action: str) -> Dict[str, object]:
        # Append user action
        self.history.append({"role": "user", "content": action})
        content = ""
        try:
            response = ollama.chat(
                model=self.model,
                messages=self.history,
                format="json"
            )
            content = response["message"]["content"]
            parsed = json.loads(content)
        except Exception:
            # Fallback if JSON parsing fails
            parsed = {
                "alive": False,
                "story": (
                    "A fatal anomaly collapsed space and time. "
                    "You perished."
                ),
            }
        finally:
            # Append assistant reply (raw content) to history for continuity
            self.history.append({"role": "assistant", "content": content})
        return parsed
