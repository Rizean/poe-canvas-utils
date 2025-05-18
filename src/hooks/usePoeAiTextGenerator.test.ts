// src/hooks/usePoeAiTextGenerator.test.ts
import { renderHook, act } from '@testing-library/react';
import usePoeAiTextGenerator, { type TextRequestCallback } from './usePoeAiTextGenerator';
import usePoeAi, { type RequestState as OriginalRequestState } from './usePoeAi';
import {type Message as PoeMessage} from "../types/Poe";
import { tryCatchSync, type Result } from '../utils/tryCatch';

// Mock the underlying usePoeAi hook
jest.mock('./usePoeAi');

const mockUsePoeAi = usePoeAi as jest.MockedFunction<typeof usePoeAi>;

describe('usePoeAiTextGenerator', () => {
    let mockSendToPoeAI: jest.Mock;
    let mockPoeAiCallback: ((state: OriginalRequestState) => void) | null = null;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSendToPoeAI = jest.fn((_prompt, callback, _options) => {
            mockPoeAiCallback = callback; // Capture the callback
            return Promise.resolve();
        });
        mockUsePoeAi.mockReturnValue([mockSendToPoeAI]);
    });

    const getSimulatedPoeState = (
        requestId: string,
        status: 'incomplete' | 'complete' | 'error',
        content: string,
        errorMsg?: string | null
    ): OriginalRequestState => ({
        requestId,
        generating: status === 'incomplete',
        error: errorMsg || null,
        responses: [{
            messageId: 'msg1',
            senderId: 'bot',
            content: content,
            contentType: 'text/markdown',
            status: status,
        }],
        status: status,
    });

    it('should call underlying usePoeAi with stream: true and pass options', async () => {
        const { result } = renderHook(() => usePoeAiTextGenerator({ logger: console }));
        const [sendTextMessage] = result.current;
        const mockCallback = jest.fn();
        const prompt = "Hello AI";
        const simResponse: PoeMessage[] = [{ messageId: 'sim1', content: 'Simulated', contentType: 'text/plain', senderId: 'sim', status: 'complete' }];

        await act(async () => {
            await sendTextMessage(prompt, mockCallback, { simulatedResponseOverride: simResponse });
        });

        expect(mockUsePoeAi).toHaveBeenCalledWith({ logger: console });
        expect(mockSendToPoeAI).toHaveBeenCalledWith(
            prompt,
            expect.any(Function),
            {
                stream: true,
                simulatedResponseOverride: simResponse,
            }
        );
    });

    it('should transform OriginalRequestState to TextRequestState correctly (incomplete and complete)', () => {
        const { result } = renderHook(() => usePoeAiTextGenerator());
        const [sendTextMessage] = result.current;
        const mockCallback = jest.fn() as jest.MockedFunction<TextRequestCallback<string>>;
        const prompt = "Generate text";

        act(() => {
            // @ts-expect-error: Mocking the sendTextMessage function
            sendTextMessage(prompt, mockCallback);
        });

        // Simulate 'incomplete' state from usePoeAi
        const incompletePoeState = getSimulatedPoeState('req1', 'incomplete', 'Hello...');
        act(() => {
            mockPoeAiCallback?.(incompletePoeState);
        });

        expect(mockCallback).toHaveBeenCalledWith({
            requestId: 'req1',
            generating: true,
            error: null,
            text: 'Hello...',
            parsed: undefined,
            rawResponse: incompletePoeState,
        });

        // Simulate 'complete' state
        const completePoeState = getSimulatedPoeState('req1', 'complete', 'Hello World!');
        act(() => {
            mockPoeAiCallback?.(completePoeState);
        });
        expect(mockCallback).toHaveBeenCalledWith({
            requestId: 'req1',
            generating: false,
            error: null,
            text: 'Hello World!',
            parsed: undefined,
            rawResponse: completePoeState,
        });
    });

    it('should handle parser function correctly', () => {
        type ParsedType = { data: string };
        const parser = (text: string): Result<ParsedType, Error> => {
            if (text.includes("error")) return [null, new Error("Parser error")];
            if (text.length < 5) return [null, new Error("Too short for parser")]; // Simulating parser needing more data
            return tryCatchSync(() => JSON.parse(text) as ParsedType);
        };

        const { result } = renderHook(() => usePoeAiTextGenerator<ParsedType>());
        const [sendTextMessage] = result.current;
        const mockCallback = jest.fn() as jest.MockedFunction<TextRequestCallback<ParsedType>>;

        act(() => {
            sendTextMessage("Parse this", mockCallback, { parser });
        });

        // Simulate partial text
        const partialPoeState = getSimulatedPoeState('req2', 'incomplete', '{"da');
        act(() => {
            mockPoeAiCallback?.(partialPoeState);
        });
        // The parser returns "Too short for parser" for '{"da' (length 4)
        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            requestId: 'req2',
            text: '{"da',
            error: "Parser error: Too short for parser", // Corrected expectation
        }));


        // Simulate valid text for parser
        const validPoeState = getSimulatedPoeState('req2', 'complete', '{"data":"done"}');
        act(() => {
            mockPoeAiCallback?.(validPoeState);
        });
        expect(mockCallback).toHaveBeenCalledWith({
            requestId: 'req2',
            generating: false,
            error: null,
            text: '{"data":"done"}',
            parsed: { data: "done" },
            rawResponse: validPoeState,
        });

        // Simulate text that causes parser to return an error (custom "Parser error")
        const errorPoeState = getSimulatedPoeState('req2', 'complete', 'error text'); // This text contains "error"
        act(() => {
            mockPoeAiCallback?.(errorPoeState);
        });
        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            requestId: 'req2',
            text: 'error text',
            error: "Parser error: Parser error", // Error from our mock parser's "text.includes('error')"
        }));
    });

    it('should set parser error if AI is successful but parser returns an error', () => {
        type ParsedType = { data: string };
        // Parser that gracefully returns an error
        const parserReturningError = (_text: string): Result<ParsedType, Error> => {
            return [null, new Error("Deliberate parser-returned error")];
        };

        const { result } = renderHook(() => usePoeAiTextGenerator<ParsedType>());
        const [sendTextMessage] = result.current;
        const mockCallback = jest.fn() as jest.MockedFunction<TextRequestCallback<ParsedType>>;

        act(() => {
            sendTextMessage("Parse this, AI success, parser fails gracefully", mockCallback, { parser: parserReturningError });
        });

        // Simulate a successful AI response (no AI error)
        const successfulAiState = getSimulatedPoeState(
            'reqWithGracefulParserError',
            'complete', // AI reports success
            'Some text for the parser to process and fail on'
            // No AI error message
        );

        act(() => {
            mockPoeAiCallback?.(successfulAiState);
        });

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            requestId: 'reqWithGracefulParserError',
            generating: false, // Because original AI state was 'complete'
            text: 'Some text for the parser to process and fail on',
            error: "Parser error: Deliberate parser-returned error", // Error from the parser's Result
            rawResponse: successfulAiState,
        }));
    });

    it('should handle unexpected throws from the parser function itself', () => {
        type ParsedType = { data: string };
        const crashingParser = (_text: string): Result<ParsedType, Error> => {
            throw new Error("Unexpected crash within parser!");
        };

        const { result } = renderHook(() => usePoeAiTextGenerator<ParsedType>());
        const [sendTextMessage] = result.current;
        const mockCallback = jest.fn() as jest.MockedFunction<TextRequestCallback<ParsedType>>;

        act(() => {
            sendTextMessage("Attempt to parse with crashing parser", mockCallback, { parser: crashingParser });
        });

        // Simulate a successful AI response (no AI error)
        const successfulAiState = getSimulatedPoeState(
            'reqWithCrashingParser',
            'complete',
            'Some text for the parser to crash on'
        );

        act(() => {
            mockPoeAiCallback?.(successfulAiState);
        });

        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
            requestId: 'reqWithCrashingParser',
            generating: false,
            text: 'Some text for the parser to crash on',
            error: "Parser crashed: Unexpected crash within parser!",
            rawResponse: successfulAiState,
        }));
    });

    it('should handle errors from usePoeAi', () => {
        const { result } = renderHook(() => usePoeAiTextGenerator());
        const [sendTextMessage] = result.current;
        const mockCallback = jest.fn();

        act(() => {
            sendTextMessage("Error test", mockCallback);
        });

        const errorPoeState = getSimulatedPoeState('req3', 'error', '', 'AI Error');
        act(() => {
            mockPoeAiCallback?.(errorPoeState);
        });

        expect(mockCallback).toHaveBeenCalledWith({
            requestId: 'req3',
            generating: false,
            error: 'AI Error',
            text: '',
            parsed: undefined,
            rawResponse: errorPoeState,
        });
    });

    it('should handle empty responses array from usePoeAi', () => {
        const { result } = renderHook(() => usePoeAiTextGenerator());
        const [sendTextMessage] = result.current;
        const mockCallback = jest.fn();
        act(() => {
            sendTextMessage("Empty response test", mockCallback);
        });

        const emptyResponsePoeState: OriginalRequestState = {
            requestId: 'req4',
            generating: false,
            error: null,
            responses: [], // Empty responses
            status: 'complete',
        };
        act(() => {
            mockPoeAiCallback?.(emptyResponsePoeState);
        });

        expect(mockCallback).toHaveBeenCalledWith({
            requestId: 'req4',
            generating: false,
            error: null,
            text: '', // Should default to empty string
            parsed: undefined,
            rawResponse: emptyResponsePoeState,
        });

        const nullResponsePoeState: OriginalRequestState = {
            requestId: 'req5',
            generating: false,
            error: null,
            responses: null, // Null responses
            status: 'complete',
        };
        act(() => {
            mockPoeAiCallback?.(nullResponsePoeState);
        });
        expect(mockCallback).toHaveBeenCalledWith({
            requestId: 'req5',
            generating: false,
            error: null,
            text: '', // Should default to empty string
            parsed: undefined,
            rawResponse: nullResponsePoeState,
        });
    });
});