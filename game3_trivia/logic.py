import json
from typing import Dict

try:
    import ollama
except ImportError as e:
    raise RuntimeError("The 'ollama' Python package is required. Install with: pip install ollama") from e


class TriviaLogic:
    def __init__(self, model: str = "gpt-oss:20b"):
        self.model = model

    def generate_round(self, topic: str) -> Dict[str, object]:
        system_prompt = (
            "You are a trivia generator. Provide 3 facts about the given topic "
            "(2 real, 1 lie). Return JSON with schema: {\"facts\": [str], \"lie_index\": int, \"explanation\": str}."
        )
        user_prompt = f"Generate three statements for the topic: **{topic}**."

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        try:
            response = ollama.chat(
                model=self.model,
                messages=messages,
                format="json"
            )
            content = response["message"]["content"]
            parsed = json.loads(content)
        except Exception:
            # Fallback structure
            parsed = {
                "facts": [
                    f"Fact 1 about {topic}",
                    f"Fact 2 about {topic}",
                    f"Fact 3 about {topic}"
                ],
                "lie_index": 3,
                "explanation": "This is a fabricated statement."
            }
        return parsed
