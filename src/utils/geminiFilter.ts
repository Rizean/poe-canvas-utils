// src/utils/geminiFilter.ts

/**
 * Filters out "Thinking..." blocks from Gemini's output.
 * It removes the "*Thinking...*" line and all subsequent lines starting with ">"
 * or empty lines until the first significant line of content that does not start with ">".
 *
 * @param text The raw text content from the AI.
 * @returns The filtered text content.
 */
export function applyGeminiThinkingFilter(text: string): string {
    if (!text) return "";
    const lines = text.split('\n');
    const outputLines: string[] = [];

    const thinkingStarLineIndex = lines.findIndex(line => line.trim() === '*Thinking...*');

    if (thinkingStarLineIndex !== -1) {
        // Start processing from the line AFTER "*Thinking...*"
        let i = thinkingStarLineIndex + 1;

        // Skip initial empty lines or lines starting with ">" immediately after "*Thinking...*"
        while (i < lines.length) {
            const trimmedLine = lines[i].trim();
            // Check if the line starts with ">" or is empty.
            // An empty line could be part of the markdown for spacing within the quote block.
            if (trimmedLine.startsWith('>') || trimmedLine === '') {
                i++;
            } else {
                // Found the first line that does not start with ">" and is not empty (after trimming)
                break;
            }
        }

        // Add all remaining lines from this point
        while (i < lines.length) {
            outputLines.push(lines[i]);
            i++;
        }
        return outputLines.join('\n');

    } else {
        // "*Thinking...*" not found, return original text
        return text;
    }
}