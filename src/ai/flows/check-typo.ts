'use server';
/**
 * @fileOverview Checks user text for typos and suggests corrections.
 *
 * - checkTypo - A function that handles the typo checking process.
 * - CheckTypoInput - The input type for the checkTypo function.
 * - CheckTypoOutput - The return type for the checkTypo function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const CheckTypoInputSchema = z.object({
  text: z.string().describe('The text to check for typos.'),
});
export type CheckTypoInput = z.infer<typeof CheckTypoInputSchema>;

const CheckTypoOutputSchema = z.object({
  correctedText: z.string().describe('The corrected text or a message indicating no typos were found.'),
});
export type CheckTypoOutput = z.infer<typeof CheckTypoOutputSchema>;

// TODO: Replacing checkTypo

export async function checkTypo(input: CheckTypoInput): Promise<CheckTypoOutput> {
  return;
  // return checkTypoFlow(input);
}

// REPLACE ME PART 1: add prompt here

// REPLACE ME PART 2: add flow here
