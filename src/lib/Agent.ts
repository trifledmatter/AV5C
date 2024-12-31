import { groq } from "@ai-sdk/groq";
import { generateObject, generateText, tool } from "ai";
import { execSync } from "child_process";
import { type CoreTool } from "ai";
import * as fs from "fs";
import { z, type ZodTypeAny } from "zod";
import { Model, type ModelValue } from "./Utils";

export default class Agent {
  public async generateStructuredData<T extends ZodTypeAny>({
    model = Model.llama33_70b_versatile,
    schema,
    prompt,
  }: {
    model?: ModelValue;
    schema: T;
    prompt: string;
  }): Promise<z.infer<T>> {
    return (
      await generateObject({
        model: groq(model),
        schema,
        prompt,
      })
    ).object;
  }

  public async agent<TTools extends Record<string, CoreTool>>({
    model = Model.llama3_groq_70b_tool_use_preview,
    system = "hi",
    prompt,
    tools,
    maxSteps = 5,
  }: {
    model?: ModelValue;
    system?: string;
    prompt: string;
    tools?: TTools;
    maxSteps?: number;
  }): Promise<string> {
    return (
      await generateText({
        model: groq(model),
        system,
        prompt,
        tools,
        maxSteps: maxSteps ?? 3,
      })
    ).text;
  }

  public async interpretImage({
    model = Model.llama32_90b_vision_preview,
    question,
    image,
  }: {
    model?: ModelValue;
    question: string;
    image: string;
  }): Promise<string> {
    return (
      await generateText({
        model: groq(model),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: question },
              {
                type: "image",
                image: new URL(image),
              },
            ],
          },
        ],
      })
    ).text;
  }

  public async readCamera(debug: boolean = false): Promise<string> {
    const cameraDevice = "/dev/video0";
    const outputFile = "/tmp/ai-sdk-camera.jpg";

    if (!fs.existsSync(cameraDevice)) {
      return "No description";
    }

    try {
      execSync(
        `ffmpeg -y \
        -f v4l2 -i ${cameraDevice} \
        -vframes 1 \
        -vf "eq=brightness=0.6:contrast=1.9:saturation=25" \
        -q:v 2 \
        ${outputFile}`,
        { stdio: "ignore" }
      );

      const buffer = fs.readFileSync(outputFile);
      const base64String = buffer.toString("base64");
      const dataUrl = `data:image/jpeg;base64,${base64String}`;

      if (debug) {
        execSync(`echo -n "${dataUrl}" | xclip -selection clipboard`, {
          stdio: "ignore",
        });
      }

      return dataUrl;
    } catch (error) {
      console.error("Error capturing camera image:", error);
      return "No description";
    }
  }
}
