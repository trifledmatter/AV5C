from typing import Any

from groq.types.chat import ChatCompletion

from groq import Groq
from .reporting import Reporter


class Actor:
    def __init__(self, api_key: str | None = None, reporter: Reporter | None = None):
        self.client = Groq(api_key=api_key)
        self.model = "llama-3.2-90b-vision-preview"
        self.reporter = reporter

    def process_environment(self, image_url: str) -> ChatCompletion | None:
        prompt: Any = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Describe the environment in one or two sentences. Then create a structured list of objects, their approximate distances (far, medium, close), and their positions (left, right, front).",
                    },
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            },
        ]

        if self.reporter:
            self.reporter.log_custom(
                level="ACTOR",
                message=f"Processing environment for image: {image_url[:50]}",
            )

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                # response_model=EnvironmentResponse,
                messages=prompt,
                temperature=0.7,
                max_tokens=512,
            )

            if self.reporter:
                self.reporter.log_custom(
                    level="ACTOR",
                    message="Environment processing completed successfully.",
                )

            return response
        except Exception as e:
            error_message = f"Error processing environment: {e}"
            if self.reporter:
                self.reporter.log_custom(level="ACTOR", message=error_message)
            print(error_message)
            return None
