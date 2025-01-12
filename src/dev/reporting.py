from typing import Any, List, Dict


class Reporter:
    def __init__(self) -> None:
        self.logs: list[Any] = []

    def _add_log_to_memory(self, level: str, message: str) -> None:
        log_entry = {"level": level, "message": message}
        self.logs.append(log_entry)

    def log_info(self, message: str) -> None:
        self._add_log_to_memory("INFO", message)

    def log_warning(self, message: str) -> None:
        self._add_log_to_memory("WARNING", message)

    def log_error(self, message: str) -> None:
        self._add_log_to_memory("ERROR", message)

    def log_debug(self, message: str) -> None:
        self._add_log_to_memory("DEBUG", message)

    def log_custom(self, level: str, message: str) -> None:
        level = level.upper()
        self._add_log_to_memory(level, message)

    def get_logs(self, level: str | None = None) -> List[Dict[str, str]]:
        if level:
            level = level.upper()
            return [log for log in self.logs if log["level"] == level]
        return self.logs

    def set_logs(self, new_logs: List[Dict[str, str]]) -> None:
        self.logs = new_logs

    def remove_logs(self, level: str | None = None) -> None:
        if level:
            level = level.lower()
            self.logs = [log for log in self.logs if log["level"].lower() != level]
        else:
            self.logs = []
