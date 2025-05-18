// src/hooks/usePoeAiTextGenerator.ts
import {useCallback} from "react";
import usePoeAi, {type RequestState as OriginalRequestState, type UseAiOptions as OriginalUseAiOptions,} from './usePoeAi'; // Adjust path as necessary
import {type Message as PoeMessage} from "../types/Poe";
import {type Result} from '../utils/tryCatch'; // Adjust path

export interface UseAiTextOptions extends OriginalUseAiOptions {
}

export interface TextRequestState<T = undefined> {
    requestId: string;
    generating: boolean;
    error: string | null;
    text: string;
    parsed?: T;
    rawResponse?: OriginalRequestState | null; // For debugging or advanced cases
}

export interface TextRequestOptions<T = undefined> {
    simulatedResponseOverride?: PoeMessage[] | null;
    parser?: (text: string) => Result<T, Error>; // Parser returns a Result tuple
}

export type TextRequestCallback<T = undefined> = (state: TextRequestState<T>) => void;

export default function usePoeAiTextGenerator<T = undefined>(
    options?: UseAiTextOptions
): [(prompt: string, callback: TextRequestCallback<T>, requestOptions?: TextRequestOptions<T>) => Promise<void>] {
    const [sendToPoeAI] = usePoeAi(options);

    const sendTextMessage = useCallback(
        async (prompt: string, callback: TextRequestCallback<T>, requestOptions?: TextRequestOptions<T>): Promise<void> => {
            const {simulatedResponseOverride, parser} = requestOptions ?? {};

            const handlePoeAiState = (originalState: OriginalRequestState) => {
                let currentText = originalState.responses?.[0]?.content || "";

                const newState: TextRequestState<T> = {
                    requestId: originalState.requestId,
                    generating: originalState.generating,
                    error: originalState.error,
                    text: currentText,
                    rawResponse: originalState,
                };

                if (!originalState.error && parser) {
                    try {
                        const [parsedData, parseErrorResult] = parser(currentText);
                        if (parseErrorResult) {
                            newState.error = `Parser error: ${parseErrorResult.message}`;
                        } else if (parsedData !== null && parsedData !== undefined) {
                            newState.parsed = parsedData;
                        }
                    } catch (unexpectedParserError) {
                        /* v8 ignore next 1 */ // No need to test String(unexpectedParserError) in the catch block
                        const message = unexpectedParserError instanceof Error ? unexpectedParserError.message : String(unexpectedParserError);
                        newState.error = `Parser crashed: ${message}`;
                    }
                }
                callback(newState);
            };

            sendToPoeAI(prompt, handlePoeAiState, {stream: true, simulatedResponseOverride: simulatedResponseOverride});
        },
        [sendToPoeAI]
    );

    return [sendTextMessage];
}