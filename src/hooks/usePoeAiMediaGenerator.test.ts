// src/hooks/usePoeAiMediaGenerator.test.ts
import {act, renderHook} from '@testing-library/react';
import usePoeAiMediaGenerator, {type MediaRequestCallback} from './usePoeAiMediaGenerator';
import type {RequestState as OriginalRequestState} from './usePoeAi';
import usePoeAi from './usePoeAi';
import type {Message as PoeMessage, MessageAttachment as PoeMessageAttachment} from "../types/Poe";

// Mock the underlying usePoeAi hook
jest.mock('./usePoeAi');

const mockUsePoeAi = usePoeAi as jest.MockedFunction<typeof usePoeAi>;

describe('usePoeAiMediaGenerator', () => {
    let mockSendToPoeAI: jest.Mock;
    let mockPoeAiCallback: ((state: OriginalRequestState) => void) | null = null;

    const sampleAttachment: PoeMessageAttachment = {
        attachmentId: 'att1',
        mimeType: 'image/png',
        url: 'https://example.com/image.png',
        isInline: false,
        name: 'image.png',
    };

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
        attachments: PoeMessageAttachment[] = [],
        errorMsg?: string | null
    ): OriginalRequestState => ({
        requestId,
        generating: status === 'incomplete', // Media can be generating
        error: errorMsg || null,
        responses: [{
            messageId: 'msg1',
            senderId: 'bot',
            content: status === 'error' ? (errorMsg || 'Media error') : 'Media generated',
            contentType: 'text/plain', // Content type might vary
            status: status,
            attachments: attachments,
        }],
        status: status,
    });


    it('should call underlying usePoeAi with stream: false and pass options', async () => {
        const {result} = renderHook(() => usePoeAiMediaGenerator({logger: console}));
        const [sendMediaMessage] = result.current;
        const mockCallback = jest.fn();
        const prompt = "Generate image";
        const simResponse: PoeMessage[] = [{
            messageId: 'sim1',
            content: 'Simulated media',
            attachments: [sampleAttachment],
            contentType: 'text/plain',
            senderId: 'sim',
            status: 'complete'
        }];
        const inputFiles = [new File(["content"], "input.txt", {type: "text/plain"})];

        await act(async () => {
            await sendMediaMessage(prompt, mockCallback, {
                simulatedResponseOverride: simResponse,
                attachments: inputFiles,
                openChat: true,
            });
        });

        expect(mockUsePoeAi).toHaveBeenCalledWith({logger: console});
        expect(mockSendToPoeAI).toHaveBeenCalledWith(
            prompt,
            expect.any(Function),
            {
                stream: false,
                simulatedResponseOverride: simResponse,
                attachments: inputFiles,
                openChat: true,
            }
        );
    });

    it('should transform OriginalRequestState to MediaRequestState correctly', () => {
        const {result} = renderHook(() => usePoeAiMediaGenerator());
        const [sendMediaMessage] = result.current;
        const mockCallback = jest.fn() as jest.MockedFunction<MediaRequestCallback>;
        const prompt = "Generate media";

        act(() => {
            sendMediaMessage(prompt, mockCallback);
        });

        // Simulate 'incomplete' state (e.g. media generation in progress)
        const incompletePoeState = getSimulatedPoeState('req1', 'incomplete', []);
        act(() => {
            mockPoeAiCallback?.(incompletePoeState);
        });
        expect(mockCallback).toHaveBeenCalledWith({
            requestId: 'req1',
            generating: true,
            error: null,
            mediaAttachments: [],
            rawResponse: incompletePoeState,
        });


        // Simulate 'complete' state with attachments
        const completePoeState = getSimulatedPoeState('req1', 'complete', [sampleAttachment]);
        act(() => {
            mockPoeAiCallback?.(completePoeState);
        });
        expect(mockCallback).toHaveBeenCalledWith({
            requestId: 'req1',
            generating: false,
            error: null,
            mediaAttachments: [sampleAttachment],
            rawResponse: completePoeState,
        });
    });

    it('should handle errors from usePoeAi', () => {
        const {result} = renderHook(() => usePoeAiMediaGenerator());
        const [sendMediaMessage] = result.current;
        const mockCallback = jest.fn();

        act(() => {
            sendMediaMessage("Error media test", mockCallback);
        });

        const errorPoeState = getSimulatedPoeState('req2', 'error', [], 'Media Generation Failed');
        act(() => {
            mockPoeAiCallback?.(errorPoeState);
        });

        expect(mockCallback).toHaveBeenCalledWith({
            requestId: 'req2',
            generating: false,
            error: 'Media Generation Failed',
            mediaAttachments: [],
            rawResponse: errorPoeState,
        });
    });

    it('should handle empty or null responses array from usePoeAi', () => {
        const {result} = renderHook(() => usePoeAiMediaGenerator());
        const [sendMediaMessage] = result.current;
        const mockCallback = jest.fn();
        act(() => {
            sendMediaMessage("Empty response media test", mockCallback);
        });

        const emptyResponsePoeState: OriginalRequestState = {
            requestId: 'req3',
            generating: false,
            error: null,
            responses: [],
            status: 'complete',
        };
        act(() => {
            mockPoeAiCallback?.(emptyResponsePoeState);
        });
        expect(mockCallback).toHaveBeenCalledWith({
            requestId: 'req3',
            generating: false,
            error: null,
            mediaAttachments: [],
            rawResponse: emptyResponsePoeState,
        });

        const nullResponsePoeState: OriginalRequestState = {
            requestId: 'req4',
            generating: false,
            error: null,
            responses: null,
            status: 'complete',
        };
        act(() => {
            mockPoeAiCallback?.(nullResponsePoeState);
        });
        expect(mockCallback).toHaveBeenCalledWith({
            requestId: 'req4',
            generating: false,
            error: null,
            mediaAttachments: [],
            rawResponse: nullResponsePoeState,
        });
    });
});