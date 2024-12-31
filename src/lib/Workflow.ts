import { z } from "zod";
import { tool } from "ai";

import Agent from "./Agent";
import Expenses, { IMAGE_COST } from "./Expenses";
import DeviceManager from "./DeviceManager";

import { get_encoding } from "tiktoken";
import { Model } from "./Utils";
import RateLimiter from "./Ratelimiter";

// const deviceManager = new DeviceManager();
// await deviceManager.connect();

const expenses = new Expenses();
const agent = new Agent();

const visionRateLimiter = new RateLimiter(
  { [Model.llama32_90b_vision_preview]: 12 },
  Model.llama32_11b_vision_preview
);

const agentRateLimiter = new RateLimiter(
  {
    [Model.llama3_groq_70b_tool_use_preview]: 28,
    [Model.llama3_groq_8b_tool_use_preview]: 28,
    [Model.llama32_3b_preview]: 28,
    [Model.llama33_70b_versatile]: 28,
  },
  Model.llama32_1b_preview
);

export default class {
  private vision_model = visionRateLimiter.chooseModel(
    Model.llama32_90b_vision_preview
  );
  private agent_model = agentRateLimiter.chooseModel(
    Model.llama3_groq_8b_tool_use_preview
  );
  private currentActions: string[] = [];
  private createMoveTool(description: string, direction: string) {
    return tool({
      description,
      parameters: z.object({
        velocity: z.number().min(1).max(199).optional(),
        duration: z.number().min(2).max(5).optional(),
      }),
      execute: async ({ velocity = 25, duration = 3 }) => {
        this.currentActions.push(direction);
        console.log(
          `Moving the robot ${direction} at ${velocity} for ${duration}`
        );

        // const command = await deviceManager.send(
        //   `vex robot move ${direction} ${velocity}`
        // );
        // await new Promise((resolve) => setTimeout(resolve, duration * 1000));
        // await deviceManager.send(`vex robot move ${direction} 0`);
        // return command;
        return "Example";
      },
    });
  }

  private move_forward = this.createMoveTool(
    "Move the robot forward",
    "forward"
  );

  private move_backward = this.createMoveTool(
    "Move the robot backward",
    "backward"
  );

  private move_left = this.createMoveTool("Rotate the robot left", "left");
  private move_right = this.createMoveTool("Rotate the robot right", "right");
  private move_armUp = this.createMoveTool("Lift the robot's arm", "armUp");

  private move_armDown = this.createMoveTool(
    "Lower the robot's arm",
    "armDown"
  );

  private move_clawOpen = this.createMoveTool(
    "Open the claw attached to the robot's arm",
    "clawOpen"
  );

  private move_clawClose = this.createMoveTool(
    "Close the claw attached to the robot's arm",
    "clawClose"
  );

  public async run() {
    const encoder = get_encoding("cl100k_base");

    const photo = await agent.readCamera();

    expenses.recordUsage(this.vision_model, "input", IMAGE_COST);

    const descriptionPrompt =
      "Describe everything in this image in enough detail needed to navigate the environment. Keep it short and concise.";

    const description = await agent.interpretImage({
      model: this.vision_model,
      question: descriptionPrompt,
      image: photo,
    });

    expenses.recordUsage(
      this.agent_model,
      "input",
      encoder.encode(descriptionPrompt).length
    );
    expenses.recordUsage(
      this.agent_model,
      "output",
      encoder.encode(description).length
    );

    const actionPrompt = `Here is a description of your environment: "${description}". Based on this environment, pick a direction to move the robot.`;

    const action = await agent.agent({
      model: this.agent_model,
      prompt: actionPrompt,
      tools: {
        move_forward: this.move_forward,
        move_backward: this.move_backward,
        move_left: this.move_left,
        move_right: this.move_right,
        move_armUp: this.move_armUp,
        move_armDown: this.move_armDown,
        move_clawOpen: this.move_clawOpen,
        move_clawClose: this.move_clawClose,
      },
    });

    expenses.recordUsage(
      this.agent_model,
      "input",
      encoder.encode(actionPrompt).length
    );

    expenses.recordUsage(
      this.agent_model,
      "output",
      encoder.encode(action).length
    );

    encoder.free();
    return `Performed ${this.currentActions.join(", ")}`;
  }

  public getExpenses() {
    return expenses;
  }

  public getUsage(model: Model, usageType: "input" | "output"): number {
    return usageType === "input"
      ? expenses.totalInputTokens[model]
      : expenses.totalOutputTokens[model];
  }
}
