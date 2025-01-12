import re
from typing import Any, List
from groq.types.chat import ChatCompletion

from .brain import BaseBrain
from .reporting import Reporter


class CommandGenerator:
    def __init__(self, brain: BaseBrain, reporter: Reporter):
        self.brain = brain
        self.reporter = reporter

    def validate(self, command: str, available_commands: List[str]) -> List[str]:
        def validate_command(command: str) -> bool:
            if not command.startswith("vex robot move"):
                return True

            if re.match(r"vex robot move \w+ \d+$", command):
                command += " 1"

            for command_template in available_commands:
                if command_template.startswith("vex robot move"):
                    pattern = (
                        r"vex robot move (forward|backward|left|right|armUp|armDown|clawOpen|clawClose) "
                        r"(\d{2,3}) (\d+(.\d+)?)"
                    )
                    if re.fullmatch(pattern, command):
                        return True
            return False

        def adjust_command(command: str) -> str:
            if not command.startswith("vex robot move"):
                return command

            if re.match(r"vex robot move \w+ \d+$", command):
                command += " 1"

            match = re.search(r"move .* (\d+) (\d+(.\d+)?)", command)
            if match:
                velocity = int(match.group(1))
                duration = float(match.group(2))

                if velocity < 10:
                    velocity = 10
                elif velocity > 188:
                    velocity = 188

                if duration < 0.5:
                    duration = 0.5
                elif duration > 3:
                    duration = 3

                command_parts = command.split()
                command_parts[-2] = str(velocity)
                command_parts[-1] = str(duration)
                command = " ".join(command_parts)

            return command

        processed_commands: list[Any] = []
        adjusted_command = adjust_command(command)

        if validate_command(adjusted_command):
            processed_commands.append(adjusted_command)

        return processed_commands

    def generate_command(
        self,
        thought_process: str,
        available_commands: List[str] = [
            "vex robot move (forward|backward|left|right|armUp|armDown|clawOpen|clawClose) (1-188) (0.5-3)",
            "vex motor all stop",
            "vex robot set (arm|claw) (0-1)",
            "vex robot get (arm|claw)",
            "vex battery getCapacity",
            "vex ping",
        ],
    ) -> str:
        decision_prompt = (
            "COMMAND MODE: You are a robot controller AI. Based on the user's intent, generate a valid command \n"
            "from the provided list of commands. You can modify placeholder values (e.g., velocity, duration) \n"
            "based on the user's thought process. For velocity, values between 10-30 are considered slow, 90-199 fast, and everything in between a medium speed. Only return the exact command string, without explanations.\n"
            "---\n"
            f"User's Thought Process: {thought_process}\n\n"
            "Available Commands:\n" + "\n".join(available_commands)
        )

        self.reporter.log_custom(
            level="COMMAND",
            message=f"Generating command for thought: {thought_process}",
        )

        decision = self.brain.think(
            intent="command-generation",
            messages=[{"role": "user", "content": decision_prompt}],
            model="llama-3.2-3b-preview",
        )

        if isinstance(decision, ChatCompletion):
            decision_message = decision.choices[0].message.content
        elif isinstance(decision, str):
            decision_message = decision.strip()
        else:
            decision_message = None

        if decision_message:
            valid_commands = self.validate(decision_message, available_commands)
            if valid_commands:
                return valid_commands[0]

            reprompt_prompt = (
                "COMMAND MODE: The command generated does not match the required structure or contains invalid values. Rewrite the command to STRICTLY conform to the provided format. Ensure velocity and duration are within valid ranges. Respond ONLY with the rewritten command, and nothing else.\n"
                "---\n"
                f"Invalid Command: {decision_message}\n\n"
                "Available Commands:\n" + "\n".join(available_commands)
            )

            decision = self.brain.think(
                intent="command-revision",
                messages=[{"role": "user", "content": reprompt_prompt}],
                model="llama-3.2-3b-preview",
            )

            if isinstance(decision, ChatCompletion):
                revised_command = decision.choices[0].message.content
            elif isinstance(decision, str):
                revised_command = decision.strip()
            else:
                revised_command = None

            if revised_command:
                valid_commands = self.validate(revised_command, available_commands)
                if valid_commands:
                    return valid_commands[0]

        error_message = "No valid command generated from thought process."
        self.reporter.log_error(message=error_message)
        return error_message
