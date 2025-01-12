import groq as base
from groq.types.chat import ChatCompletion

from typing import List, Dict, Union, Any


class BaseBrain:

    def __init__(self, model: str = "llama3-8b-8192", api_key: str | None = None):
        self.model = model

        self.client = base.Groq(timeout=3)

        self.extended_chat_history: list[Any] = []
        self.optimized_chat_history: list[Any] = []

        self.api_key = api_key if api_key else ""

    def truncate_history(
        self, history: List[Dict[str, Union[str, Dict[str, Any]]]], max_items: int
    ) -> List[Dict[str, Union[str, Dict[str, Any]]]]:
        return history[-max_items:]

    def add_message(
        self,
        role: str,
        content: Union[str, List[Dict[str, Union[str, Dict[str, Any]]]]],
        history_type: str = "extended",
    ) -> None:
        message: dict[str, Any] = {"role": role, "content": content}
        if history_type == "extended":
            self.extended_chat_history.append(message)
            self.extended_chat_history = self.truncate_history(
                self.extended_chat_history, 12
            )
        elif history_type == "optimized":
            self.optimized_chat_history.append(message)
            self.optimized_chat_history = self.truncate_history(
                self.optimized_chat_history, 3
            )

    def add_image(self, environment: str, prompt: str) -> None:
        message_content: list[Any] = [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": environment}},
        ]
        self.add_message("user", message_content, history_type="extended")
        self.add_message("user", message_content, history_type="optimized")

    def think(
        self,
        intent: str,
        messages: List[Dict[str, Any]],
        model: str | None = None,
        temperature: float = 1,
        max_tokens: int = 1024,
        top_p: float = 1,
        stream: bool = False,
        verbose_result: bool = False,
    ) -> str | ChatCompletion | None:
        if not model:
            model = self.model

        if model not in [
            "llama3-groq-70b-8192-tool-use-preview",
            "llama3-groq-8b-8192-tool-use-preview",
            "llama-3.2-1b-preview",
            "llama-3.2-3b-preview",
            "llama3-8b-8192",
            "mixtral-8x7b-32768",
            "llama-3.2-90b-vision-preview",
            "llama-3.2-11b-vision-preview",
            "llama-3.3-70b-versatile",
        ]:
            raise ValueError(f"Invalid model: {model}")

        try:
            response: Any = self.client.chat.completions.create(
                messages=messages,  # type: ignore
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=top_p,
                stream=stream,
            )

            if not verbose_result:
                return response.choices[0].message.content  # type: ignore
            else:
                return response  # type: ignore
        except Exception as e:
            print(f"Error during {intent}: {e}")
            return None
