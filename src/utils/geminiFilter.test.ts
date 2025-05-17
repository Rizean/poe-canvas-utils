// src/utils/geminiFilter.test.ts
import { applyGeminiThinkingFilter } from './geminiFilter';

describe('applyGeminiThinkingFilter', () => {
    it('should return an empty string if input is empty', () => {
        expect(applyGeminiThinkingFilter('')).toBe('');
    });

    it('should return an empty string if input is null (coerced to empty by function)', () => {
        // @ts-expect-error testing null input
        expect(applyGeminiThinkingFilter(null)).toBe('');
    });

    it('should return the original text if "*Thinking...*" is not found', () => {
        const text = "This is a normal message.\nWith multiple lines.";
        expect(applyGeminiThinkingFilter(text)).toBe(text);
    });

    it('should remove "*Thinking...*" and subsequent ">" lines', () => {
        const text = "*Thinking...*\n> This is a thought.\n> Another thought.\nActual content starts here.";
        const expected = "Actual content starts here.";
        expect(applyGeminiThinkingFilter(text)).toBe(expected);
    });

    it('should handle "*Thinking...*" with leading/trailing spaces on its line', () => {
        const text = "  *Thinking...*  \n> Thought.\nContent.";
        const expected = "Content.";
        expect(applyGeminiThinkingFilter(text)).toBe(expected);
    });

    it('should remove "*Thinking...*" and ">" lines even if no actual content follows', () => {
        const text = "*Thinking...*\n> Thought 1\n> Thought 2";
        const expected = "";
        expect(applyGeminiThinkingFilter(text)).toBe(expected);
    });

    it('should handle empty lines within the ">" block', () => {
        const text = "*Thinking...*\n> Thought 1\n\n> Thought 2\n\nActual content.";
        const expected = "Actual content.";
        expect(applyGeminiThinkingFilter(text)).toBe(expected);
    });

    it('should handle cases where "*Thinking...*" is the only content', () => {
        const text = "*Thinking...*";
        const expected = ""; // No content after thinking block
        expect(applyGeminiThinkingFilter(text)).toBe(expected);
    });

    it('should handle content immediately after "*Thinking...*" without ">" lines', () => {
        // This case implies the filter might be too aggressive if not careful,
        // but current logic looks for ">" or empty lines to skip.
        // If the line after *Thinking...* is not ">" and not empty, it's considered content.
        const text = "*Thinking...*\nThis is immediate content.";
        const expected = "This is immediate content.";
        expect(applyGeminiThinkingFilter(text)).toBe(expected);
    });

    it('should handle mixed content before and after thinking block', () => {
        // This should never happen in a real scenario, but let's test it.
        // Test Case: Thinking block is in the middle, content before and after
        const textWithPrefix = "Hello Gemini.\n*Thinking...*\n> Planning response.\nHere is your answer.";
        const expectedWithPrefix = "Here is your answer.";
        expect(applyGeminiThinkingFilter(textWithPrefix)).toBe(expectedWithPrefix);

        const textOnlyThinking = "*Thinking...*\n> Just thinking.";
        expect(applyGeminiThinkingFilter(textOnlyThinking)).toBe("");
    });

    it('should handle multiple "*Thinking...*" blocks (keeps content after the first one processed)', () => {
        // This should never happen in a real scenario, but let's test it.
        // The current filter finds the *first* occurrence and processes from there.
        const text = "*Thinking...*\n> First thought.\nContent 1.\n*Thinking...*\n> Second thought.\nContent 2.";
        const expected = "Content 1.\n*Thinking...*\n> Second thought.\nContent 2.";
        expect(applyGeminiThinkingFilter(text)).toBe(expected);
    });

    it('should handle text with only ">" lines after "*Thinking...*"', () => {
        const text = "*Thinking...*\n> \n> \n> ";
        expect(applyGeminiThinkingFilter(text)).toBe("");
    });

    it('should handle text with empty thinking ">" lines after "*Thinking...*" followed by content', () => {
        const text = "*Thinking...*\n> \n> \n> \nContent after empty thinking lines.";
        expect(applyGeminiThinkingFilter(text)).toBe("Content after empty thinking lines.");
    });

    it('should handle text where content starts with ">" but is not part of thinking block', () => {
        const text = "This is normal text.\n> This is a quote, not a thought.";
        expect(applyGeminiThinkingFilter(text)).toBe(text);

        const text2 = "*Thinking...*\n> Thought.\nStart of response\n> This is a quote after thinking.";
        const expected2 = "Start of response\n> This is a quote after thinking.";
        expect(applyGeminiThinkingFilter(text2)).toBe(expected2);
    });
});