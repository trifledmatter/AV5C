import cv2
import base64
import threading
import time

from .reporting import Reporter

from typing import Union, Callable


class Camera:
    def __init__(
        self, reporter: Reporter, stream_url: str = "http://10.0.0.27:4747/video"
    ):
        self.stream_url = stream_url
        self.cap = cv2.VideoCapture(self.stream_url)

        self.reporter = reporter

        if not self.cap.isOpened():
            raise ValueError(f"Unable to access video stream at {self.stream_url}")

        self.running = False
        self.frame = None

    def snap_photo(self, base64_encode: bool = False) -> Union[bytes, str]:
        ret, frame = self.cap.read()
        if not ret:
            raise RuntimeError("Failed to capture photo.")

        _, buffer = cv2.imencode(".jpg", frame)
        raw_data = buffer.tobytes()

        self.reporter.log_info(message="Captured image from camera")

        if base64_encode:
            return (
                f"data:image/jpeg;base64,{base64.b64encode(raw_data).decode('utf-8')}"
            )
        return raw_data

    def get_video_stream(self) -> cv2.VideoCapture:
        return self.cap

    def stream_video(
        self,
        callback: Callable[[Union[bytes, str]], None] | None = None,
        base64_encode: bool = False,
        fps: int = 30,
    ) -> None:
        self.running = True
        frame_interval = 1.0 / fps

        def stream() -> None:
            last_frame_time = 0
            while self.running:
                current_time = time.time()
                if current_time - last_frame_time < frame_interval:
                    continue

                ret, frame = self.cap.read()
                if not ret:
                    print("Failed to grab frame.")
                    break
                self.frame = frame # type: ignore
                last_frame_time = current_time # type: ignore

                if callback:
                    if base64_encode:
                        _, buffer = cv2.imencode(".jpg", frame)
                        raw_data = buffer.tobytes()
                        base64_uri = f"data:image/jpeg;base64,{base64.b64encode(raw_data).decode('utf-8')}"
                        callback(base64_uri)
                    else:
                        callback(frame) # type: ignore

            self.running = False

        threading.Thread(target=stream, daemon=True).start()

    def stop_stream(self) -> None:
        self.reporter.log_info(message="Image stream stopped")
        self.running = False

    def release(self) -> None:
        self.cap.release()
