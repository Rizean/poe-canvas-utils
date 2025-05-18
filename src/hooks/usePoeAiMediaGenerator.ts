// src/hooks/usePoeAiMediaGenerator.ts
import {useCallback} from "react";
import type {RequestState as OriginalRequestState, UseAiOptions as OriginalUseAiOptions} from './usePoeAi';
import usePoeAi from './usePoeAi';
import type {Message as PoeMessage, MessageAttachment as PoeMessageAttachment} from "../types/Poe";

export interface UseAiMediaOptions extends OriginalUseAiOptions {
}

export interface MediaRequestState {
    requestId: string;
    generating: boolean; // Media generation can also be 'generating' until complete/error
    error: string | null;
    mediaAttachments: PoeMessageAttachment[]; // Changed from File[] to PoeMessageAttachment[]
    rawResponse?: OriginalRequestState | null;
}

export interface MediaRequestOptions {
    simulatedResponseOverride?: PoeMessage[] | null;
    attachments?: File[]; // Files to SEND with the prompt
    openChat?: boolean; // Whether to attempt to open the Poe chat interface
}

export type MediaRequestCallback = (state: MediaRequestState) => void;

export default function usePoeAiMediaGenerator(
    options?: UseAiMediaOptions
): [(prompt: string, callback: MediaRequestCallback, requestOptions?: MediaRequestOptions) => Promise<void>] {
    const [sendToPoeAI] = usePoeAi(options);

    const sendMediaMessage = useCallback(
        async (
            prompt: string,
            callback: MediaRequestCallback,
            requestOptions?: MediaRequestOptions
        ): Promise<void> => {
            const {simulatedResponseOverride, attachments, openChat} = requestOptions ?? {};

            const handlePoeAiState = (originalState: OriginalRequestState) => {
                let currentMediaAttachments: PoeMessageAttachment[] = [];
                if (originalState.responses && originalState.responses.length > 0) {
                    // Assuming the first message contains the media attachments
                    /* v8 ignore next 1 */ // Default to empty array if no attachments
                    currentMediaAttachments = originalState.responses[0].attachments || [];
                }

                const newState: MediaRequestState = {
                    requestId: originalState.requestId,
                    generating: originalState.generating, // Reflect generating state
                    error: originalState.error,
                    mediaAttachments: currentMediaAttachments,
                    rawResponse: originalState,
                };
                callback(newState);
            };

            sendToPoeAI(
                prompt,
                handlePoeAiState,
                {
                    stream: false, // Always false for media generator (typically)
                    simulatedResponseOverride: simulatedResponseOverride,
                    attachments: attachments,
                    openChat: openChat,
                }
            );
        },
        [sendToPoeAI]
    );

    return [sendMediaMessage];
}