import { Model } from "./Utils";

export const IMAGE_COST = 6400;

export default class Expenses {
  public totalInputTokens: Record<Model, number> = {
    [Model.llama3_groq_70b_tool_use_preview]: 0,
    [Model.llama3_groq_8b_tool_use_preview]: 0,
    [Model.llama32_1b_preview]: 0,
    [Model.llama32_3b_preview]: 0,
    [Model.llama32_90b_vision_preview]: 0,
    [Model.llama32_11b_vision_preview]: 0,
    [Model.llama33_70b_versatile]: 0,
  };

  public totalOutputTokens: Record<Model, number> = {
    [Model.llama3_groq_70b_tool_use_preview]: 0,
    [Model.llama3_groq_8b_tool_use_preview]: 0,
    [Model.llama32_1b_preview]: 0,
    [Model.llama32_3b_preview]: 0,
    [Model.llama32_90b_vision_preview]: 0,
    [Model.llama32_11b_vision_preview]: 0,
    [Model.llama33_70b_versatile]: 0,
  };

  public MODEL_PRICING_USD: Record<Model, { input: number; output: number }> = {
    [Model.llama3_groq_70b_tool_use_preview]: { input: 0.89, output: 0.89 },
    [Model.llama3_groq_8b_tool_use_preview]: { input: 0.19, output: 0.19 },
    [Model.llama32_1b_preview]: { input: 0.04, output: 0.04 },
    [Model.llama32_3b_preview]: { input: 0.06, output: 0.06 },
    [Model.llama32_90b_vision_preview]: { input: 0.9, output: 0.9 },
    [Model.llama32_11b_vision_preview]: { input: 0.18, output: 0.18 },
    [Model.llama33_70b_versatile]: { input: 0.59, output: 0.79 },
  };

  public recordUsage(
    model: Model,
    usageType: "input" | "output",
    tokens: number
  ): void {
    if (usageType === "input") {
      this.totalInputTokens[model] += tokens;
    } else {
      this.totalOutputTokens[model] += tokens;
    }
  }

  public getPriceInCad(
    model: Model,
    usageType: "input" | "output",
    tokens: number
  ): number {
    const factorPerMillion = this.MODEL_PRICING_USD[model]?.[usageType] ?? 0;

    const factorPerTokenUSD = factorPerMillion / 1_000_000;

    const exchangeRate = parseFloat(process.env.USD_EXCHANGE_RATE ?? "1.45");
    const markup = parseFloat(process.env.GROQ_CAD_MARKUP ?? "1.15");

    return tokens * factorPerTokenUSD * exchangeRate * markup;
  }

  public getTotalExpensesInCad(): number {
    let total = 0;
    for (const model of Object.values(Model)) {
      total += this.getPriceInCad(
        model,
        "input",
        this.totalInputTokens[model] || 0
      );
      total += this.getPriceInCad(
        model,
        "output",
        this.totalOutputTokens[model] || 0
      );
    }
    return total;
  }

  public resetUsage(): void {
    for (const model of Object.values(Model)) {
      this.totalInputTokens[model] = 0;
      this.totalOutputTokens[model] = 0;
    }
  }
}
