from typing import Any, Dict, List

from .reporting import Reporter


class RateLimiter:
    def __init__(
        self,
        currency_conversion_rate: float = 1.5,
        tax_rate: float = 0.15,
        reporter: Reporter | None = None,
        max_spend_cad: float = 20.0,
    ):
        self.MODEL_PRICING_USD: Dict[str, Dict[str, float]] = {
            "llama3_groq_70b_tool_use_preview": {"input": 0.89, "output": 0.89},
            "llama3_groq_8b_tool_use_preview": {"input": 0.19, "output": 0.19},
            "llama32_1b_preview": {"input": 0.04, "output": 0.04},
            "llama32_3b_preview": {"input": 0.06, "output": 0.06},
            "llama32_90b_vision_preview": {"input": 0.9, "output": 0.9},
            "llama32_11b_vision_preview": {"input": 0.18, "output": 0.18},
            "llama33_70b_versatile": {"input": 0.59, "output": 0.79},
        }

        self.MODEL_LIMITS: Dict[str, Dict[str, int]] = {
            "llama3_groq_70b_tool_use_preview": {
                "requests_per_minute": 30,
                "requests_per_day": 14400,
                "tokens_per_minute": 6000,
                "tokens_per_day": 200000,
            },
            "llama3_groq_8b_tool_use_preview": {
                "requests_per_minute": 30,
                "requests_per_day": 14400,
                "tokens_per_minute": 20000,
                "tokens_per_day": 500000,
            },
            "llama32_1b_preview": {
                "requests_per_minute": 30,
                "requests_per_day": 7000,
                "tokens_per_minute": 7000,
                "tokens_per_day": 500000,
            },
            "llama32_3b_preview": {
                "requests_per_minute": 30,
                "requests_per_day": 7000,
                "tokens_per_minute": 7000,
                "tokens_per_day": 500000,
            },
            "llama32_90b_vision_preview": {
                "requests_per_minute": 15,
                "requests_per_day": 3500,
                "tokens_per_minute": 7000,
                "tokens_per_day": 250000,
            },
            "llama32_11b_vision_preview": {
                "requests_per_minute": 30,
                "requests_per_day": 7000,
                "tokens_per_minute": 7000,
                "tokens_per_day": 500000,
            },
            "llama33_70b_versatile": {
                "requests_per_minute": 30,
                "requests_per_day": 1000,
                "tokens_per_minute": 6000,
                "tokens_per_day": 100000,
            },
        }

        self.currency_conversion_rate = currency_conversion_rate
        self.tax_rate = tax_rate
        self.reporter = reporter if reporter else Reporter()
        self.max_spend_cad = max_spend_cad

        self.model_usage: Dict[str, Dict[str, int]] = {
            model: {
                "tokens_used": 0,
                "tokens_max": self.MODEL_LIMITS[model]["tokens_per_day"],
                "requests_used": 0,
                "requests_max": self.MODEL_LIMITS[model]["requests_per_day"],
            }
            for model in self.MODEL_PRICING_USD.keys()
        }

        self.fallbacks: Dict[str, List[str]] = {
            "llama3_groq_70b_tool_use_preview": ["llama3_groq_8b_tool_use_preview"],
            "llama3_groq_8b_tool_use_preview": ["llama32_3b_preview"],
            "llama32_1b_preview": [],
            "llama32_3b_preview": [],
            "llama32_90b_vision_preview": ["llama32_11b_vision_preview"],
            "llama32_11b_vision_preview": [],
            "llama33_70b_versatile": ["llama3_groq_70b_tool_use_preview"],
        }

        self.expenses: Dict[str, float] = {
            model: 0.0 for model in self.MODEL_PRICING_USD.keys()
        }

    def track_usage(self, model: str, tokens_input: int, tokens_output: int) -> None:
        if model not in self.model_usage:
            raise ValueError(f"Model {model} not found in tracking system.")

        usage = self.model_usage[model]
        pricing = self.MODEL_PRICING_USD[model]

        usage["tokens_used"] += tokens_input + tokens_output
        usage["requests_used"] += 1

        if usage["tokens_used"] > usage["tokens_max"] * 0.9:
            self.reporter.log_warning(message=f"Model {model} is close to token limit.")
        if usage["requests_used"] > usage["requests_max"] * 0.9:
            self.reporter.log_warning(
                message=f"Model {model} is close to request limit."
            )

        cost_usd = (
            tokens_input * pricing["input"] + tokens_output * pricing["output"]
        ) / 1000
        cost_cad = cost_usd * self.currency_conversion_rate * (1 + self.tax_rate)
        self.expenses[model] += cost_cad

        total_spent = sum(self.expenses.values())
        if total_spent > self.max_spend_cad * 0.8:
            self.reporter.log_warning(
                message="Total spending is close to the maximum limit."
            )
        if total_spent > self.max_spend_cad:
            self.reporter.log_error(message="Maximum spending limit reached.")
            raise RuntimeError("Spending limit exceeded.")

        self.reporter.log_info(
            f"Tracked usage for model {model}: {tokens_input} input tokens, {tokens_output} output tokens."
        )

    def get_usage(self, model: str) -> Dict[str, int]:
        if model not in self.model_usage:
            raise ValueError(f"Model {model} not found in tracking system.")
        return self.model_usage[model]

    def get_expenses(self) -> Dict[str, float]:
        return self.expenses

    def check_rate_limit(self, model: str) -> bool:
        if model not in self.model_usage:
            raise ValueError(f"Model {model} not found in tracking system.")

        usage = self.model_usage[model]
        limits = self.MODEL_LIMITS[model]

        within_minute_token_limit = usage["tokens_used"] <= limits["tokens_per_minute"]
        within_daily_token_limit = usage["tokens_used"] <= usage["tokens_max"]

        within_minute_request_limit = (
            usage["requests_used"] <= limits["requests_per_minute"]
        )
        within_daily_request_limit = usage["requests_used"] <= usage["requests_max"]

        if usage["tokens_used"] > usage["tokens_max"] * 0.8:
            self.reporter.log_warning(
                message=f"Model {model} is close to its daily token limit."
            )
        if usage["requests_used"] > usage["requests_max"] * 0.8:
            self.reporter.log_warning(
                message=f"Model {model} is close to its daily request limit."
            )

        return (
            within_minute_token_limit
            and within_daily_token_limit
            and within_minute_request_limit
            and within_daily_request_limit
        )

    def get_fallback_model(self, model: str) -> str | None:
        if model not in self.fallbacks:
            raise ValueError(f"Model {model} not found in fallback system.")

        fallbacks = self.fallbacks[model]
        for fallback in fallbacks:
            if self.check_rate_limit(fallback):
                self.reporter.log_info(
                    message=f"Using fallback model {fallback} for {model}."
                )
                return fallback

        return None

    def wrap_model_call(
        self, model: str, func: Any, *args: tuple[Any, ...], **kwargs: tuple[Any, ...]
    ) -> Any:
        if not self.check_rate_limit(model):
            fallback = self.get_fallback_model(model)
            if fallback:
                self.reporter.log_info(
                    message=f"Switching to fallback model: {fallback}"
                )
                model = fallback
            else:
                self.reporter.log_error(
                    message=f"Rate limit exceeded for model {model} and no fallback available."
                )
                raise RuntimeError(
                    f"Rate limit exceeded for model {model} and no fallback available."
                )

        if "model" in kwargs:
            kwargs["model"] = model  # type: ignore
        else:
            kwargs.update({"model": model})  # type: ignore

        if "verbose_results" in kwargs:
            kwargs["verbose_results"] = True  # type: ignore
        else:
            kwargs.update({"verbose_results": True})  # type: ignore

        result = func(*args, **kwargs)

        tokens_input = result.get("usage", {}).get("prompt_tokens", 0)
        tokens_output = result.get("usage", {}).get("completion_tokens", 0)
        self.track_usage(model, tokens_input, tokens_output)

        return result
