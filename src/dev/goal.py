from typing import Any, List, Dict, Union
from groq.types.chat import ChatCompletion
import queue

from .brain import BaseBrain
from .reporting import Reporter


class Goals:
    def __init__(self, brain: BaseBrain, reporter: Reporter):
        self.brain = brain
        self.reporter = reporter
        self.goal_queue: queue.Queue[dict[str, Any]] = queue.Queue()

    def create_goal(self, goal_id: str, goal_text: str) -> Dict[str, str]:
        return {
            "id": goal_id,
            "request": goal_text,
            "accepted": "pending",
            "reason": "No reason provided.",
        }

    def validate_goal(self, goal: Dict[str, str]) -> bool:
        required_keys = {"id", "request", "accepted", "reason"}

        if not required_keys.issubset(goal.keys()):
            return False

        if goal["accepted"] not in {"pending", "accepted", "denied"}:
            return False

        return True

    def decide_goal(
        self, goal: Dict[str, Union[str, Dict[str, str]]]
    ) -> tuple[str | dict[str, str], str | dict[str, str]]:
        decision_prompt = (
            "GOAL MODE: Someone has submitted a new goal for you.\n"
            "---\n"
            f"You are an AI baked into a robot with the abilities to move forward, backward, left, right, or adjust your arm / claw, and you're responsible for deciding whether to accept or deny the following goal:\n\n"
            f"Goal: {goal['request']}\n\n"
            "Respond with 'accepted' or 'denied', and explain your decision incredibly concisely with a max of 8 words."
        )

        self.reporter.log_custom(
            level="GOAL", message=f"Deciding on goal: {goal['request']}"
        )

        decision = self.brain.think(
            intent="goal-decision",
            messages=[{"role": "user", "content": decision_prompt}],
            model="llama3-8b-8192",
        )

        if isinstance(decision, ChatCompletion):
            decision = decision.choices[0].message.content

        if not decision:
            goal["accepted"] = "denied"
            goal["reason"] = "I don't even know what to make of this"
            return goal["accepted"], goal["reason"]

        if (
            decision
            and ("accepted" in decision.lower())
            or ("accept" in decision.lower())
        ):
            goal["accepted"] = "accepted"
        else:
            goal["accepted"] = "denied"

        goal["reason"] = decision

        self.reporter.log_custom(
            level="GOAL",
            message=f"Goal decision: {goal['accepted']}, Reason: {goal['reason']}",
        )

        return goal["accepted"], goal["reason"]

    def submit_goal(self, goal: Dict[str, str]) -> str:
        if not self.validate_goal(goal):
            self.reporter.log_custom(
                level="GOAL", message="Invalid goal submission attempted."
            )
            return "Invalid goal submission: Ensure all required fields are properly formatted."

        self.goal_queue.put(goal)
        self.reporter.log_custom(
            level="GOAL", message=f"Goal submitted: {goal['id']} - {goal['request']}"
        )
        return f"Goal with ID '{goal['id']}' successfully submitted."

    def get_next_goal(self) -> Union[Dict[str, str], None]:
        if self.goal_queue.empty():
            self.reporter.log_custom(level="GOAL", message="No goals in the queue.")
            return None

        goal = self.goal_queue.get()
        self.reporter.log_custom(
            level="GOAL",
            message=f"Retrieved next goal: {goal['id']} - {goal['request']}",
        )
        return goal

    def list_goals(self) -> List[Dict[str, str]]:
        goals = list(self.goal_queue.queue)
        self.reporter.log_custom(
            level="GOAL", message=f"Listing all goals: {len(goals)} goals in queue."
        )
        return goals
