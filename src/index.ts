import "dotenv/config";
import Workflow from "./lib/Workflow";
import { Model } from "./lib/Utils";

const workflow = new Workflow();
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_WAIT_TIME_MS: number = 1000;
const ERROR_WAIT_TIME_MS: number = 5000;
const TOKEN_WAIT_MULTIPLIER_MS: number = 10;

const runWorkflowLoop = async (): Promise<void> => {
  const workflow = new Workflow();
  const actionsPerMinute = 6;

  while (true) {
    try {
      const res = await workflow.run();
      console.log("Workflow result:", res);

      let inputTokens: number = 0;
      let outputTokens: number = 0;

      const modelStats: Model[] = [
        Model.llama32_90b_vision_preview,
        Model.llama32_11b_vision_preview,
        Model.llama33_70b_versatile,
        Model.llama32_3b_preview,
        Model.llama3_groq_70b_tool_use_preview,
        Model.llama3_groq_8b_tool_use_preview,
      ];

      for (const model of modelStats) {
        inputTokens += workflow.getUsage(model, "input");
        outputTokens += workflow.getUsage(model, "output");
      }

      let waitTime: number;

      if (inputTokens > 0 || outputTokens > 0) {
        waitTime = ((inputTokens + outputTokens) * TOKEN_WAIT_MULTIPLIER_MS) / actionsPerMinute;
        console.log(`Waiting for ${waitTime / 1000}s to avoid rate limiting.`);
      } else {
        waitTime = DEFAULT_WAIT_TIME_MS;
        console.log(`No tokens used. Waiting for default ${waitTime / 1000}s.`);
      }

      await delay(waitTime);
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error during workflow execution:", error.message);
      } else {
        console.error("Unknown error during workflow execution:", error);
      }

      console.log(`Waiting for ${ERROR_WAIT_TIME_MS} ms before retrying.`);
      await delay(ERROR_WAIT_TIME_MS);
    }
  }
};

runWorkflowLoop().catch((error) => {
  console.error("Unhandled error in workflow loop:", error);
  process.exit(1);
});
