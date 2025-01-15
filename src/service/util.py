import redis
from typing import Optional
from dotenv import get_key, load_dotenv


def process_env(
    key: str, fallback: str | None = None, path: str = "./.env"
) -> str | None:
    load_dotenv(dotenv_path=path)
    return get_key(path, key_to_get=key, encoding="utf-8") or fallback


class CameraStore:
    def __init__(self, host: str = "localhost", port: int = 6379, db: int = 0):
        self.client = redis.StrictRedis(
            host=host, port=port, db=db, decode_responses=True
        )

    def set_frame(self, src: str, frame: str) -> None:
        self.client.set(src, frame)

    def get_frame(self, src: str) -> Optional[str]:
        return self.client.get(src)

    def clear_frames(self, src: str) -> None:
        self.client.delete(src)

    def get_all_sources(self) -> list[str]:
        return self.client.keys()

    def clear_all(self) -> None:
        self.client.flushdb()
