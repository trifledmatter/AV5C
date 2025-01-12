import time
from typing import List, Optional
from threading import Event, Thread

from pydantic import BaseModel

from src.dev.actor import Actor
from src.dev.brain import BaseBrain
from src.dev.camera import Camera
from src.dev.device import DeviceManager
from src.dev.gen import CommandGenerator
from src.dev.goal import Goals
from src.dev.reporting import Reporter

from src.service.types.misc import LogEntry
from src.service.types.status import ServiceStatus as State

from groq.types.chat import ChatCompletion


class ServiceConfig(BaseModel):
    actor_name: str
    max_commands: Optional[int] = 100


class ServiceManager:
    def __init__(self, reporter: Reporter, goals: Goals):
        self.log = reporter

        self.goals = goals

        self.state = State(
            running=False,
            goal=None,
            commands_executed=0,
            log_size=0,
        )
        self.commands_ran: List[str] = []
        self.service_thread: Optional[Thread] = None
        self.stop_event = Event()
        self.logs: List[LogEntry] = []

    def log_action(self, level: str, message: str) -> None:
        """
        Logs an action and updates the log size in the state.
        """
        log_entry = LogEntry(level=level, message=message)
        self.logs.append(log_entry)
        self.state.log_size = len(self.logs)
        self.log.log_custom(level, message)

    def start_service(self) -> bool:
        """
        Starts the service thread if not already running.
        Returns True if started successfully, False otherwise.
        """
        if self.state.running:
            self.log_action("WARNING", "Service is already running.")
            return False

        self.state.running = True
        self.stop_event.clear()
        self.service_thread = Thread(target=self.run_service, daemon=True)
        self.service_thread.start()

        self.log_action("SERVICE", "Service started successfully.")
        return True

    def stop_service(self) -> bool:
        """
        Stops the service thread gracefully.
        Returns True if stopped successfully, False otherwise.
        """
        if not self.state.running:
            self.log_action("WARNING", "Service is not running.")
            return False

        self.stop_event.set()

        if self.service_thread:
            self.service_thread.join(timeout=5)  # Graceful stop

        self.state.running = False
        self.state.goal = None
        self.log_action("SERVICE", "Service stopped successfully.")
        return True

    def run_service(self) -> None:
        try:
            self.log.log_custom("INTERNAL", "Internal service started")

            brain = BaseBrain()
            device = DeviceManager()
            camera = Camera(reporter=self.log)
            actor = Actor(reporter=self.log)
            gen = CommandGenerator(brain, reporter=self.log)

            while self.state.running:
                if self.stop_event.is_set():
                    self.log.log_custom("INTERNAL", "Internal service stopped")
                    break

                if not self.goals.goal_queue.empty():
                    goal = self.goals.get_next_goal()
                    if goal:
                        self.state.goal = goal["goal_request"]
                        self.log.log_custom(
                            "SERVICE", f"Processing goal: {goal['goal_request']}"
                        )

                        scene = camera.snap_photo(True)
                        if isinstance(scene, str):
                            process_env = actor.process_environment(scene)

                            if not process_env:
                                self.log.log_custom(
                                    "SERVICE",
                                    f"Could not process environment for goal: '{goal['goal_request']}'",
                                )
                                continue

                            objectives = [process_env.choices[0].message.content]

                            if not objectives:
                                self.log.log_custom(
                                    "SERVICE",
                                    f"No objectives found for goal: '{goal['goal_request']}'",
                                )
                                continue

                        else:
                            self.log.log_custom(
                                "SERVICE",
                                f"Could not process environment for goal: '{goal['goal_request']}'",
                            )
                            continue

                    else:
                        self.log.log_custom(
                            "SERVICE", "No goals found, exploring by default."
                        )
                        objectives = ["move around and explore your enviornment"]

                    if isinstance(objectives, str):
                        objectives = [objectives]

                    for objective in objectives:
                        if self.stop_event.is_set():
                            self.log.log_custom(
                                "INTERNAL", "Stop event detected during goal execution"
                            )
                            break

                        thought_process = brain.think(
                            "internal_thoughts",
                            [
                                {
                                    "role": "system",
                                    "content": "You are an AI robot that must think about their objective. Respond concisely, you will be given a description of your environment, and your goal is to think through what actions you should take based off of the environment at all costs.",
                                },
                                {
                                    "role": "user",
                                    "content": f"Environment: {objective}",
                                },
                            ],
                        )

                        if isinstance(thought_process, ChatCompletion):
                            thought_process = thought_process.choices[0].message.content

                        command = "vex motor all stop"  # default to stopping

                        if thought_process:
                            command = gen.generate_command(
                                thought_process=thought_process
                            )
                            if "error" in command.lower():
                                self.log.log_error(
                                    f"Failed to generate command for objective: {self.state.goal}"
                                )
                                continue

                        device.add_command(command)
                        self.commands_ran.append(command)

                        self.log.log_custom("COMMAND", f"{command}")

                        response = device.current_response
                        if response:
                            self.log.log_custom("COMMAND", f"Completed: {response}")
                        else:
                            self.log.log_custom(
                                "COMMAND", f"Command executed but no response recieved"
                            )

                    time.sleep(1)
                self.state.goal = None
        except Exception as e:
            print(e)
            self.log.log_error("There was an error in the service")
        finally:
            self.state.running = False
            self.stop_event.clear()
            self.log.log_custom("INTERNAL", "Internal service stopped")

    def get_status(self) -> State:
        """
        Returns the current status of the service.
        """
        return self.state

    def get_logs(self, level: Optional[str] = None) -> List[LogEntry]:
        """
        Retrieves logs, optionally filtered by level.
        """
        if level:
            level = level.upper()
            return [log for log in self.logs if log.level == level]
        return self.logs
