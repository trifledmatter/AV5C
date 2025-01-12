import re
import serial
import threading
import queue
from typing import Optional, Any

from .reporting import Reporter


class DeviceManager:
    def __init__(
        self, port: str = "/dev/ttyACM1", rate: int = 115200, reporter: Reporter | None = None
    ):
        self.port = port
        self.rate = rate
        self.reporter = reporter if reporter else Reporter()
        self.connection = serial.Serial(self.port, self.rate, timeout=5)

        self.command_queue: queue.Queue[str] = queue.Queue()
        self.stop_event = threading.Event()
        self.response_lock = threading.Lock()
        self.current_response = None

        self.listener_thread = threading.Thread(target=self._listen, daemon=True)
        self.listener_thread.start()
        self.worker_thread = threading.Thread(
            target=self._process_commands, daemon=True
        )
        self.worker_thread.start()

    def _listen(self) -> None:
        while not self.stop_event.is_set():
            try:
                line = self.connection.readline().decode("utf-8").strip()
                match = re.search(r"<#>(.*?)<#>", line)
                if match:
                    response = match.group(1)
                    with self.response_lock:
                        self.current_response = response # type: ignore
                    self.reporter.log_info(message=f"Received response: {response}")
            except Exception as e:
                with self.response_lock:
                    self.current_response = None
                self.reporter.log_error(message=f"Error in listener: {e}")

    def _process_commands(self) -> None:
        while not self.stop_event.is_set():
            try:
                command = self.command_queue.get(timeout=1)
                self.reporter.log_info(message=f"Processing command: {command}")
                self.send_command(command)

                if command.startswith("vex robot move"):
                    duration = self._extract_duration(command)
                    if duration:
                        self.reporter.log_info(
                            f"Waiting for duration: {duration} seconds"
                        )
                        threading.Event().wait(duration)

                response = self._wait_for_response()
                if response:
                    self.reporter.log_info(
                        message=f"Command completed: {command}, Response: {response}"
                    )
                else:
                    self.reporter.log_warning(
                        message=f"Command completed: {command}, No response received."
                    )

                self.command_queue.task_done()
            except queue.Empty:
                continue

    def send_command(self, command: str) -> None:
        try:
            self.connection.write(f"{command}\n".encode("utf-8"))
            self.connection.flush()
            self.reporter.log_info(message=f"Sent command: {command}")
        except serial.SerialException as e:
            self.reporter.log_error(
                message=f"Error while sending command: {command}, Error: {e}"
            )

    def _extract_duration(self, command: str) -> Optional[float]:
        match = re.search(r"vex robot move.*?(\d+(?:\.\d+)?)$", command)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                self.reporter.log_warning(
                    message=f"Invalid duration format in command: {command}"
                )
                return None
        return None

    def _wait_for_response(self, timeout: int = 5) -> Optional[str]:
        for _ in range(timeout):
            with self.response_lock:
                if self.current_response:
                    response = self.current_response
                    self.current_response = None
                    return response
            threading.Event().wait(1)
        return None

    def get_queue_status(self) -> dict[str, Any]:
        return {
            "queued_commands": self.command_queue.qsize(),
            "is_running": not self.stop_event.is_set(),
        }

    def add_command(self, command: str, priority: bool = False) -> None:
        if priority:
            self.command_queue.put(command, block=False)
        else:
            self.command_queue.put(command)
        self.reporter.log_info(message=f"Added command to queue: {command}")

    def stop(self) -> None:
        self.stop_event.set()
        if self.connection and self.connection.is_open:
            self.connection.close()
        self.listener_thread.join()
        self.worker_thread.join()
        self.reporter.log_info("Device manager stopped.")
