import { Model } from "./Utils";

const DEFAULT_THRESHOLDS: Record<Model, number> = {
  [Model.llama3_groq_70b_tool_use_preview]: 28,
  [Model.llama3_groq_8b_tool_use_preview]: 28,
  [Model.llama32_1b_preview]: 28,
  [Model.llama32_3b_preview]: 28,
  [Model.llama32_90b_vision_preview]: 12,
  [Model.llama32_11b_vision_preview]: 28,
  [Model.llama33_70b_versatile]: 28,
};

export default class RateLimiter {
  private usageTimestamps: Record<Model, number[]>;

  private usageThresholds: Record<Model, number>;
  private fallbackModel: Model;

  constructor(
    usageThresholds: Partial<Record<Model, number>> = {},
    fallbackModel: Model = Model.llama3_groq_8b_tool_use_preview
  ) {
    this.usageThresholds = { ...DEFAULT_THRESHOLDS, ...usageThresholds };

    this.usageTimestamps = {} as Record<Model, number[]>;
    for (const model of Object.values(Model)) {
      this.usageTimestamps[model] = [];
    }

    this.fallbackModel = fallbackModel;
  }

  public recordUsage(model: Model): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;

    this.usageTimestamps[model] = this.usageTimestamps[model].filter(
      (t) => t > oneMinuteAgo
    );

    this.usageTimestamps[model].push(now);
  }

  public chooseModel(desiredModel: Model): Model {
    this.recordUsage(desiredModel);

    const threshold = this.usageThresholds[desiredModel];
    const usageCount = this.usageTimestamps[desiredModel].length;

    if (usageCount > threshold) {
      console.warn(
        `Model ${desiredModel} exceeded rate limit of ${threshold} calls/min. Using fallback model: ${this.fallbackModel}`
      );
      return this.fallbackModel;
    }

    return desiredModel;
  }

  public getUsageCount(model: Model): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;

    return this.usageTimestamps[model].filter((t) => t > oneMinuteAgo).length;
  }
}
