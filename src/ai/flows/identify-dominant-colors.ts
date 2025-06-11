'use server';
/**
 * @fileOverview This file defines a Genkit flow to identify the dominant colors in an image.
 *
 * - identifyDominantColors - A function that takes an image data URI and returns a list of dominant colors.
 * - IdentifyDominantColorsInput - The input type for the identifyDominantColors function.
 * - IdentifyDominantColorsOutput - The return type for the identifyDominantColors function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const IdentifyDominantColorsInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type IdentifyDominantColorsInput = z.infer<typeof IdentifyDominantColorsInputSchema>;

const IdentifyDominantColorsOutputSchema = z.object({
  dominantColors: z.array(z.string()).describe('A list of dominant colors in the image.'),
});
export type IdentifyDominantColorsOutput = z.infer<typeof IdentifyDominantColorsOutputSchema>;

export async function identifyDominantColors(input: IdentifyDominantColorsInput): Promise<IdentifyDominantColorsOutput> {
  return identifyDominantColorsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'identifyDominantColorsPrompt',
  input: {
    schema: z.object({
      photoDataUri: z
        .string()
        .describe(
          "A photo, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
        ),
    }),
  },
  output: {
    schema: z.object({
      dominantColors: z.array(z.string()).describe('A list of dominant colors in the image.'),
    }),
  },
  prompt: `You are an AI assistant that analyzes images and identifies the dominant colors.

  Analyze the image provided and identify the dominant colors present. Return a list of these colors.

  Image: {{media url=photoDataUri}}
  `,
});

const identifyDominantColorsFlow = ai.defineFlow<
  typeof IdentifyDominantColorsInputSchema,
  typeof IdentifyDominantColorsOutputSchema
>({
  name: 'identifyDominantColorsFlow',
  inputSchema: IdentifyDominantColorsInputSchema,
  outputSchema: IdentifyDominantColorsOutputSchema,
}, async input => {
  const {output} = await prompt(input);
  return output!;
});
