export enum Model {
  llama3_groq_70b_tool_use_preview = "llama3-groq-70b-8192-tool-use-preview",
  llama3_groq_8b_tool_use_preview = "llama3-groq-8b-8192-tool-use-preview",
  llama32_1b_preview = "llama-3.2-1b-preview",
  llama32_3b_preview = "llama-3.2-3b-preview",
  llama32_90b_vision_preview = "llama-3.2-90b-vision-preview",
  llama32_11b_vision_preview = "llama-3.2-11b-vision-preview",
  llama33_70b_versatile = "llama-3.3-70b-versatile",
}

export type ModelKey = keyof typeof Model;
export type ModelValue = (typeof Model)[ModelKey];
export const getGroqModel = (model: ModelKey): ModelValue => {
  return Model[model];
};
