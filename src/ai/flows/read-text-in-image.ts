'use server';
/**
 * @fileOverview Reads text in an image and returns the text.
 *
 * - readTextInImage - A function that handles the text reading process.
 * - ReadTextInImageInput - The input type for the readTextInImage function.
 * - ReadTextInImageOutput - The return type for the readTextInImage function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';


const ReadTextInImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ReadTextInImageInput = z.infer<typeof ReadTextInImageInputSchema>;

const ReadTextInImageOutputSchema = z.object({
  text: z.string().describe('The text found in the image.'),
});
export type ReadTextInImageOutput = z.infer<typeof ReadTextInImageOutputSchema>;

// TODO: Replace readTextInImage

export async function readTextInImage(input: ReadTextInImageInput): Promise<ReadTextInImageOutput> {
  return;
  // return readTextInImageFlow(input);
}

/***********************************************************************************/
// Uncomment the code below to embed conditional logic directly into our prompt.
/***********************************************************************************/
/***********************************************************************************/

// const prompt = ai.definePrompt({
//   name: 'readTextInImagePrompt',
//   input: {
//     schema: z.object({
//       photoDataUri: z
//         .string()
//         .describe(
//           "A photo, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
//         ),
//     }),
//   },
//   output: {
//     schema: z.object({
//       text: z.string().describe('The text found in the image.'),
//     }),
//   },
//   prompt: `You are an AI assistant that extracts text from images.

//   Given the following image, extract any text present in the image.

//   Image: {{media url=photoDataUri}}

//   Text:
//   `,
// });

/***********************************************************************************/
/***********************************************************************************/


// REPLACE ME: Creating Prmopt
