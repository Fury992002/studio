'use server';
/**
 * @fileOverview Extracts data fields from an invoice template using AI.
 *
 * - extractDataFromInvoiceTemplate - A function that handles the data extraction process.
 * - ExtractDataFromInvoiceTemplateInput - The input type for the extractDataFromInvoiceTemplate function.
 * - ExtractDataFromInvoiceTemplateOutput - The return type for the extractDataFromInvoiceTemplate function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractDataFromInvoiceTemplateInputSchema = z.object({
  invoiceTemplateDataUri: z
    .string()
    .describe(
      "An invoice template, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractDataFromInvoiceTemplateInput = z.infer<typeof ExtractDataFromInvoiceTemplateInputSchema>;

const ExtractDataFromInvoiceTemplateOutputSchema = z.object({
  fields: z
    .array(z.string())
    .describe('An array of data fields extracted from the invoice template.'),
});
export type ExtractDataFromInvoiceTemplateOutput = z.infer<typeof ExtractDataFromInvoiceTemplateOutputSchema>;

export async function extractDataFromInvoiceTemplate(
  input: ExtractDataFromInvoiceTemplateInput
): Promise<ExtractDataFromInvoiceTemplateOutput> {
  return extractDataFromInvoiceTemplateFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractDataFromInvoiceTemplatePrompt',
  input: {schema: ExtractDataFromInvoiceTemplateInputSchema},
  output: {schema: ExtractDataFromInvoiceTemplateOutputSchema},
  prompt: `You are an expert in understanding invoice templates. Your task is to identify and extract all the data fields present in the given invoice template. Return the data fields as an array of strings.

Invoice Template: {{media url=invoiceTemplateDataUri}}`,
});

const extractDataFromInvoiceTemplateFlow = ai.defineFlow(
  {
    name: 'extractDataFromInvoiceTemplateFlow',
    inputSchema: ExtractDataFromInvoiceTemplateInputSchema,
    outputSchema: ExtractDataFromInvoiceTemplateOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
