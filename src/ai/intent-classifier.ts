'use server';

import { ai } from '@/ai/ai-instance';
import { z } from 'zod';

// Define the possible intent categories

// REPLACE ME PART 1: add IntentCategory here

// 1. Define Input Schema (Remains the same)
const ClassifyIntentInputSchema = z.object({
  userQuery: z.string().describe("The user's query to classify."),
});
export type ClassifyIntentInput = z.infer<typeof ClassifyIntentInputSchema>;

// 2. Define Output Schema
const ClassifyIntentOutputSchema = z.object({
  intent: z.string().describe("The classified intent category. Should be one of: DescribeImage, AskAboutImage, ReadTextInImage, IdentifyColorsInImage, TakePicture, StartCamera, SelectImage, StopSpeaking, SetDescriptionDetailed, SetDescriptionConcise, GeneralInquiry, OutOfScopeRequest."),
});
export type ClassifyIntentOutput = z.infer<typeof ClassifyIntentOutputSchema>;

// Define Agent Capabilities and Limitations for the prompt

// REPLACE ME PART 2: add AGENT_CAPABILITIES_AND_LIMITATIONS here


// 3. Define the Prompt

// REPLACE ME PART 3 - classifyIntentPrompt

// 4. Define the Flow
export const classifyIntentFlow = ai.defineFlow<
  typeof ClassifyIntentInputSchema,
  typeof ClassifyIntentOutputSchema
>(
  {
    name: 'classifyIntentFlow',
    inputSchema: ClassifyIntentInputSchema,
    outputSchema: ClassifyIntentOutputSchema,
  },
  async (input) => {
    console.log(`Attempting to classify intent for query: "${input.userQuery}"`);
    if (!input.userQuery || input.userQuery.trim() === "") {
        console.warn("Cannot classify empty query.");
        return { intent: "Unknown" }; // Or "GeneralInquiry" if you prefer for empty
    }

    try {
      const { output } = await classifyIntentPrompt(input);

      if (!output || !output.intent) {
          console.error("Intent classification prompt did not return valid output for query:", input.userQuery);
          return { intent: "Unknown" };
      }

      const validCategories: string[] = [
          "DescribeImage", "AskAboutImage", "ReadTextInImage", "IdentifyColorsInImage",
          "TakePicture", "StartCamera", "SelectImage", "StopSpeaking",
          "SetDescriptionDetailed", "SetDescriptionConcise",
          "GeneralInquiry", "OutOfScopeRequest",
          // "Unknown" is a possible outcome but not a category the LLM should target directly in the happy path.
      ];

      if (validCategories.includes(output.intent)) {
          console.log(`Query: "${input.userQuery}" successfully classified as Intent: ${output.intent}`);
          return { intent: output.intent };
      } else {
          // This case means the LLM returned something not in our explicit validCategories list.
          // This is different from it *choosing* "Unknown" from the prompt instructions.
          console.warn(`AI returned an unexpected or invalid category string: "${output.intent}" for query: "${input.userQuery}". Defaulting to 'Unknown'.`);
          return { intent: "Unknown" };
      }
    } catch (error) {
      console.error(`Error during intent classification flow for query "${input.userQuery}":`, error);
      return { intent: "Unknown" };
    }
  }
);