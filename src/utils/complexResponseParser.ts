// src/utils/complexResponseParser.ts
import { type Result } from './tryCatch';

/**
 * Defines the structure of the parsed output from the complex AI response.
 */
export interface ParsedComplexAiResponse {
    /** The primary textual response extracted. */
    response: string;
    /** Optional structured data extracted and parsed from a ```json ... ``` block.
     *  This key will be absent if no JSON block is found or if parsing fails.
     */
    data?: unknown;
}

/**
 * Optional configuration for the complexResponseParser.
 */
export interface ComplexParserOptions {
    /** The string marking the beginning of the primary response block. Defaults to "<response>". */
    responseStartTag?: string;
    /** The string marking the end of the primary response block. Defaults to "</response>". */
    responseEndTag?: string;
}

const DEFAULT_RESPONSE_START_TAG = "<response>";
const DEFAULT_RESPONSE_END_TAG = "</response>";

/**
 * Parses a complex AI response string that may include a primary response
 * enclosed in configurable tags, and an optional JSON data block.
 *
 * The expected AI response format (with default tags) is:
 * *...Potentially some preliminary text...*
 * <response>
 * ....response goes here
 * </response>
 * *...Potentially some text after response block but before JSON...*
 * ```json
 * json data here...
 * ```
 *
 * @param rawText The raw text response from the AI.
 * @param options Optional configuration for custom response tags.
 * @returns A Result tuple:
 *   - On success: `[ParsedComplexAiResponse, null]`
 *   - On failure (e.g., malformed JSON in a declared JSON block): `[null, Error]`
 */
export const complexResponseParser = (
    rawText: string,
    options?: ComplexParserOptions
): Result<ParsedComplexAiResponse, Error> => {
    const startTag = options?.responseStartTag ?? DEFAULT_RESPONSE_START_TAG;
    const endTag = options?.responseEndTag ?? DEFAULT_RESPONSE_END_TAG;

    let responseContent = "";
    let textAfterResponseBlock = rawText; // Start with the full text for JSON searching

    // 1. Extract content between responseStartTag and responseEndTag
    const responseStartIndex = rawText.indexOf(startTag);

    if (responseStartIndex !== -1) {
        const contentActualStartIndex = responseStartIndex + startTag.length;
        const responseEndIndex = rawText.indexOf(endTag, contentActualStartIndex);

        if (responseEndIndex !== -1) {
            // Both start and end tags found
            responseContent = rawText.substring(contentActualStartIndex, responseEndIndex);
            // Text for JSON search is what comes *after* the response block's end tag
            textAfterResponseBlock = rawText.substring(responseEndIndex + endTag.length);
        } else {
            // Only start tag found (incomplete stream for the response block)
            // Capture everything from after startTag to the end of the current text
            responseContent = rawText.substring(contentActualStartIndex);
            // If the response block is incomplete, we assume JSON (if any) hasn't started yet,
            // so we effectively don't search for JSON in this partial state,
            // or rather, textAfterResponseBlock would be empty if the stream ends here.
            // A more robust approach for streaming might be to only look for JSON *after* the responseEndTag is confirmed.
            // For now, if response is incomplete, JSON search will be on an empty or non-existent part.
            textAfterResponseBlock = ""; // Or handle as per desired streaming behavior for JSON after incomplete response
        }
    } else {
        // No start tag found. responseContent remains "".
        // JSON search will be on the original rawText.
        textAfterResponseBlock = rawText;
    }

    // 2. Extract and parse JSON data from a ```json ... ``` block
    // This search is now performed on textAfterResponseBlock or rawText if no response block was found
    let jsonData: unknown | undefined = undefined;

    const jsonBlockRegex = /```json\n([\s\S]*?)\n```/;
    // Search for JSON in the part of the text that is *after* the identified response block,
    // or in the whole text if no response block start tag was found.
    const jsonMatch = textAfterResponseBlock.match(jsonBlockRegex);

    if (jsonMatch?.[1]) {
        try {
            jsonData = JSON.parse(jsonMatch[1]);
        } catch (e: any) {
            /* v8 ignore next 1 */ // No need to test default message
            return [null, new Error(e?.message || 'Error parsing JSON content within ```json block')];
        }
    }

    // 3. Construct the successful result payload
    const resultPayload: ParsedComplexAiResponse = {
        response: responseContent.trim(), // Trim the extracted response
    };

    if (jsonData !== undefined) {
        resultPayload.data = jsonData;
    }

    return [resultPayload, null];
};