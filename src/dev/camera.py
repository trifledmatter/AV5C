import time
import requests
import base64
from PIL import Image
from io import BytesIO
from typing import Optional
from pydantic import BaseModel, Field
import threading

from .reporting import Reporter
from src.service.util import process_env, CameraStore


class Camera(BaseModel):
    stream_url: str = Field(..., description="URL of the camera stream")
    reporter: Reporter
    store: CameraStore
    running: bool = Field(
        default=True, description="Indicates if the stream is running"
    )
    thread: Optional[threading.Thread] = Field(default=None, exclude=True)

    class Config:
        arbitrary_types_allowed = True

    def __init__(
        self, reporter: Reporter, store: CameraStore, stream_url: Optional[str] = None
    ):
        super().__init__(
            stream_url=stream_url
            or f"http://{process_env('CAMERA_SOURCE', '10.0.0.74')}:4747/video",
            reporter=reporter,
            store=store,
        )
        self.running = True
        self.thread = threading.Thread(target=self._fetch_stream, daemon=True)
        self.thread.start()
        self.reporter.log_info("Camera streaming initialized and started.")

    def _fetch_stream(self) -> None:
        try:
            with requests.get(self.stream_url, stream=True, timeout=1) as response:
                response.raise_for_status()
                buffer = b""

                for chunk in response.iter_content(chunk_size=8192):
                    if not self.running:
                        break

                    buffer += chunk
                    start = buffer.find(b"\xff\xd8")
                    end = buffer.find(b"\xff\xd9")
                    if start != -1 and end != -1:
                        frame = buffer[start : end + 2]
                        buffer = buffer[end + 2 :]

                        try:
                            image = Image.open(BytesIO(frame))
                            temp_buffer = BytesIO()
                            image.save(temp_buffer, format="JPEG")
                            raw_frame = temp_buffer.getvalue()
                            encoded_frame = f"data:image/jpeg;base64,{base64.b64encode(raw_frame).decode("utf-8")}"
                            self.store.set_frame(self.stream_url, encoded_frame)
                        except Exception as e:
                            self.reporter.log_error(f"Error processing frame: {e}")

        except requests.exceptions.RequestException as e:
            self.reporter.log_error(f"Error during streaming: {e}")
            time.sleep(3)
            self._fetch_stream()

    def stop_stream(self) -> None:
        if not self.running:
            self.reporter.log_info("Stream is not running.")
            return

        self.running = False
        self.reporter.log_info("Stream stopped.")

    def snap_photo(self) -> str:
        latest_frame = self.store.get_frame(self.stream_url)
        if latest_frame is None:
            raise RuntimeError("No frame available to capture.")

        self.reporter.log_info("Captured image from the latest frame.")
        return latest_frame

    def get_video_stream(self) -> Optional[str]:
        return self.store.get_frame(self.stream_url)

    def release(self) -> None:
        self.stop_stream()
        self.store.set_frame(self.stream_url, "")
        self.reporter.log_info("Released camera resources.")
