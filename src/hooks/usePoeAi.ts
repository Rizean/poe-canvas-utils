// src/hooks/usePoeAi.ts
import {useCallback, useEffect, useRef, useState} from "react";
import {type Message, type MessageStatus, PoeEmbedAPIError, type SendUserMessageResult} from "../types/Poe";
import {tryCatchSync} from "../utils/tryCatch";

// ====================================================================================
// Interfaces and Types
// ====================================================================================

/**
 * Interface for a basic logger, compatible with the standard `console` object.
 * Used for logging internal hook operations and potential issues.
 */
interface Logger {
    debug(...data: unknown[]): void;

    error(...data: unknown[]): void;

    info(...data: unknown[]): void;

    log(...data: unknown[]): void;

    trace(...data: unknown[]): void;

    warn(...data: unknown[]): void;
}

/**
 * Represents the state of a single AI request initiated via `sendToAI`.
 */
export interface RequestState {
    /** Unique identifier for this specific request. */
    requestId: string;
    /** True if a response is currently being generated or streamed for this request. */
    generating: boolean;
    /** An error message if this request failed, otherwise null. */
    error: string | null;
    /** An array of message responses received for this request. May be partial during streaming or null initially/on error. */
    responses: Message[] | null;
    /** The current overall status of the request ('incomplete', 'complete', 'error'). */
    status: MessageStatus;
}

/**
 * Callback function type provided by the consumer to receive state updates for a specific request.
 * @param state - The latest state of the request.
 */
export type RequestCallback = (state: RequestState) => void;

/**
 * Options that can be provided specifically for a single `sendToAI` call,
 * potentially overriding global hook settings for that request.
 */
export interface RequestOptions {
    /** Whether to request streaming responses for this specific request. Defaults to false. */
    stream?: boolean;
    /** Whether to attempt to open the Poe chat interface when sending this message. Defaults to false. */
    openChat?: boolean;
    /** If simulating, provides a specific set of messages to return for this request, overriding global simulation responses. */
    simulatedResponseOverride?: Message[] | null;
    /** Files to include as attachments for this user message. */
    attachments?: File[];
}

/**
 * Configuration options for the `usePoeAi` hook itself, applied globally to all requests
 * initiated by this hook instance unless overridden by `RequestOptions`.
 */
export interface UseAiOptions {
    /**
     * A unique name for the main message handler registered by this hook instance with the Poe API.
     * If not provided, a random name will be generated. Ensure uniqueness if multiple hook instances
     * might interact with the API simultaneously on the same page.
     */
    handler?: string;
    /**
     * If true, ALL requests initiated by this hook instance will be simulated locally
     * instead of contacting the Poe API. Useful for development and testing.
     * Defaults to `true` if `window.Poe` is not detected at hook initialization, `false` otherwise.
     * Explicitly setting this value overrides the automatic detection.
     */
    simulation?: boolean;
    /** Global delay in milliseconds before returning a simulated response. Applies to all simulations unless overridden. Defaults to 1000ms. */
    simulationDelay?: number;
    /** Global probability (0-100) that a simulated request will result in an error. Defaults to 20 (20%). */
    simulateErrorChance?: number;
    /** Optional global set of messages to return during simulation if no `simulatedResponseOverride` is provided in `RequestOptions`. */
    simulationResponses?: Message[] | null;
    /** Logger instance to use for internal logging. Defaults to the global `console` object. */
    logger?: Logger;
}

// ====================================================================================
// Helper Functions
// ====================================================================================

/**
 * Generates a reasonably unique identifier string for tracking individual requests.
 * @returns A unique request ID string.
 */
const generateRequestId = (): string => `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

/**
 * Merges provided hook options with default values to create a complete configuration object.
 * Also normalizes `simulateErrorChance` to a 0-1 range.
 * @param options - Optional user-provided hook options.
 * @returns A full options object with defaults applied.
 */
const getDefaultHookOptions = (options?: UseAiOptions): Required<Omit<UseAiOptions, 'handler' | 'simulationResponses'>> & {
    handler?: string,
    simulationResponses: Message[] | null
} => {
    const errorChanceInput = options?.simulateErrorChance ?? 20;
    // Clamp error chance between 0 and 100, then normalize to 0-1 probability
    const clampedChance = Math.min(Math.max(errorChanceInput, 0), 100);
    const normalizedErrorChance = clampedChance / 100;

    // Determine default simulation mode based on Poe API availability, unless explicitly overridden
    const defaultSimulation = typeof window !== 'undefined' && !window.Poe;
    const simulation = options?.simulation ?? defaultSimulation;

    return {
        handler: options?.handler,
        simulation: simulation,
        simulationDelay: options?.simulationDelay ?? 1000,
        simulateErrorChance: normalizedErrorChance,
        logger: options?.logger ?? console,
        simulationResponses: options?.simulationResponses ?? null,
    };
}

// ====================================================================================
// Simulation Helper (Included for completeness, assumed external or within same file)
// ====================================================================================

/**
 * Options for customizing the result generated by `simulationSendUserMessageResult`.
 */
type SimulationResponseOptions = {
    /** Whether to include a default placeholder attachment in simulated messages if none are provided. Defaults to true. */
    includeDefaultAttachment?: boolean;
    /** The overall status for the simulated `SendUserMessageResult`. Defaults to 'complete'. */
    status?: MessageStatus;
    /** An array of partial message objects to use for the simulation. Defaults to a single generic message object. */
    responses?: Partial<Message>[];
}

/**
 * Creates a simulated `SendUserMessageResult` object, mimicking a response from the Poe API.
 * Useful for testing and development simulation.
 * @param opts - Options to customize the simulated response.
 * @returns A `SendUserMessageResult` object.
 */
export function simulationSendUserMessageResult(opts?: SimulationResponseOptions): SendUserMessageResult {
    const options = {
        includeDefaultAttachment: opts?.includeDefaultAttachment ?? true,
        /* v8 ignore next 1 */ // Default parameter
        status: opts?.status ?? "complete",
        responses: opts?.responses ?? [{}],
    };

    // Construct full Message objects from partials
    const simulatedMessages: Message[] = options.responses.map((partialMsg, index) => {
        const message: Message = {
            // Provide defaults for common message fields
            messageId: partialMsg.messageId || `sim_${Date.now()}_${index}`,
            senderId: partialMsg.senderId || "SimulatedAI",
            content: partialMsg.content || `This is simulated message #${index + 1}.`,
            contentType: partialMsg.contentType || "text/plain",
            // Message status often mirrors the overall result status, but can be overridden
            status: partialMsg.status || options.status,
            // TODO: test user defined simulated error
            statusText: partialMsg.statusText || (options.status === 'error' ? "Simulated error" : undefined),
            attachments: partialMsg.attachments,
        };

        // Add a default placeholder attachment if requested and none were provided
        if (options.includeDefaultAttachment && !partialMsg.attachments) {
            message.attachments = [{
                attachmentId: `sim_att_${Date.now()}_${index}`,
                mimeType: "image/png",
                url: "https://placehold.co/400.png",
                isInline: false,
                name: "placeholder.png",
            }];
        }
        return message;
    });

    return {
        status: options.status,
        responses: simulatedMessages,
    };
}


// ====================================================================================
// usePoeAi Hook Implementation
// ====================================================================================

/**
 * Custom React hook to interact with a Poe AI bot via the Poe Embed API.
 * Manages API communication or simulation, allowing multiple concurrent requests,
 * each with independent state tracking delivered via callbacks.
 *
 * @param options - Optional global configuration for this hook instance (e.g., simulation settings, logger).
 * @returns A tuple containing a single function: `sendToAI`.
 *          Call `sendToAI` to initiate a new request.
 */
export default function usePoeAi(
    options?: UseAiOptions
): [(prompt: string, callback: RequestCallback, requestOptions?: RequestOptions) => void] {

    // --- Hook Setup and State ---

    // Generate a stable, unique handler name for this hook instance if not provided in options.
    // This name is used to register with the Poe API.
    const [handlerName] = useState(() => options?.handler ?? `poeHandler_${generateRequestId()}`);
    const hookOpts = useRef(getDefaultHookOptions(options));

    useEffect(() => {
        hookOpts.current = getDefaultHookOptions(options);
    }, [options]);

    const {logger, simulation: globalSimulation} = hookOpts.current;
    const activeRequests = useRef<Map<string, { state: RequestState; callback: RequestCallback }>>(new Map());
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    // --- Poe API Interaction & Response Handling ---

    /**
     * The single callback function registered with `window.Poe.registerHandler`.
     * It receives results from the Poe API (or simulated results), identifies the
     * corresponding request using `context.requestId`, updates the internal state
     * for that request, and invokes the user-provided callback.
     */
    const handlePoeResponse = useCallback((result: SendUserMessageResult, context?: { requestId?: string }) => {
        const requestId = context?.requestId;
        /* v8 ignore next 4 */ // This is defence against Poe API changes or failures
        if (!requestId) {
            logger.error("Received Poe response without a valid requestId in context.", result, context);
            return;
        }
        const requestEntry = activeRequests.current.get(requestId);
        if (!requestEntry) {
            logger.warn(`Received response for unknown or completed request ID: ${requestId}`, result);
            return;
        }
        /* v8 ignore next 4 */ // Very difficult to trigger
        if (!isMounted.current) {
            logger.warn(`Component unmounted, discarding response for request ID: ${requestId}`);
            return;
        }

        logger.debug(`[ReqID: ${requestId}] Received response data via handler:`, result);

        const currentState = requestEntry.state;
        const newState: RequestState = {
            ...currentState,
            status: result.status,
            generating: result.status === 'incomplete', // Still generating only if status is 'incomplete'
            // Update responses, preserving previous ones if the new result doesn't provide any (e.g., intermediate errors)
            /* v8 ignore next 1 */ // The simulation does not currently support streaming so this is impossible to trigger in testing
            responses: result.responses ?? currentState.responses,
            error: null, // Assume success initially, clear previous errors
        };

        if (result.status === "error") {
            const errorMsg = result.responses
                ?.map(msg => { // These generally should never happen, but if they do we handle them
                    /* v8 ignore next */ // For the 'Bot' fallback
                    const sender = msg.senderId || 'Bot';
                    /* v8 ignore next */ // For the 'Unknown error' fallback
                    const statusText = msg.statusText || 'Unknown error';
                    // The 'null' part of the ternary is hard to hit if msg.status is always 'error' here and we expect a statusText for errors.
                    /* v8 ignore next */ // This ignores the `null` part of the ternary if msg.status is always 'error'
                    return msg.status === 'error' ? `[${sender} Error]: ${statusText}` : null;
                })
                .filter(Boolean)
                .join("\n")
                /* v8 ignore next */ // For the "An unknown error..." fallback
                || "An unknown error occurred during response generation.";
            newState.error = errorMsg;
            logger.error(`[ReqID: ${requestId}] Error status received:`, errorMsg);
        }
        /* v8 ignore next 6 */
        else if (result.status !== "incomplete" && result.status !== "complete") {
            const unknownStatusError = `Unknown status received from AI handler: ${result.status}`;
            newState.error = unknownStatusError;
            newState.status = "error";
            logger.error(`[ReqID: ${requestId}] ${unknownStatusError}`);
        }

        activeRequests.current.set(requestId, {...requestEntry, state: newState});

        // --- Invoke User Callback ---
        try {
            requestEntry.callback(newState);
        } catch (callbackError) {
            logger.error(`[ReqID: ${requestId}] Error executing request callback:`, callbackError);
        }

        // --- Cleanup ---
        // If the request has reached a terminal state (complete or error), remove it from the active map.
        if (newState.status === "complete" || newState.status === "error") {
            logger.debug(`[ReqID: ${requestId}] Request finished with status: ${newState.status}. Cleaning up entry.`);
            activeRequests.current.delete(requestId);
        }

    }, [logger]);

    /**
     * Effect to register the `handlePoeResponse` function with the Poe API when the hook mounts
     * (and if not in simulation mode) and unregister it when the hook unmounts.
     */
    useEffect(() => {
        if (globalSimulation || typeof window === 'undefined' || !window.Poe) {
            logger.warn(`Simulation mode (${globalSimulation}) or Poe API not available. Skipping handler registration.`);
            return;
        }

        // Register the handler with the generated or provided name.
        logger.debug(`Registering global Poe handler: ${handlerName}`);
        const unregister = window.Poe.registerHandler(handlerName, handlePoeResponse);

        return () => {
            logger.debug(`Unregistering global Poe handler: ${handlerName}`);
            if (typeof window !== 'undefined' && window.Poe && typeof unregister === 'function') {
                unregister();
                activeRequests.current.clear();
            }
        };
    }, [handlerName, handlePoeResponse, logger, globalSimulation]);


    const simulateResponse = useCallback((
        requestId: string,
        _callback: RequestCallback, // callback is not directly used here, handlePoeResponse uses stored one
        _initialState: RequestState, // initialState is not directly used here
        simulatedResponseOverride?: Message[] | null,
    ) => {
        logger.debug(`[ReqID: ${requestId}] Simulating AI response...`);

        const delay = hookOpts.current.simulationDelay;
        const errorChance = hookOpts.current.simulateErrorChance;

        // Use setTimeout to simulate the asynchronous nature of an API call.
        setTimeout(() => {
            /* v8 ignore next 5 */ // Defensive check, effectively impossible to trigger
            if (!isMounted.current) {
                logger.warn(`[ReqID: ${requestId}] Component unmounted during simulation delay.`);
                activeRequests.current.delete(requestId);
                return;
            }
            // Double-check if the request is still active (it might have been cancelled/cleaned up).
            /* v8 ignore next 4 */ // Defensive check, effectively impossible to trigger
            if (!activeRequests.current.has(requestId)) {
                logger.warn(`[ReqID: ${requestId}] Simulation timer fired but request no longer active.`);
                return;
            }

            // Determine if this simulation should result in an error.
            const randomRoll = Math.random(); // Value between 0 and 1
            const willSimulateError = errorChance > 0 && randomRoll <= errorChance;
            const logInfo = `(Error Chance: ${Math.round(errorChance * 100)}%, Rolled: ${Math.round(randomRoll * 100)}%)`;

            let simulatedResult: SendUserMessageResult;

            // Create a simulated error result.
            if (willSimulateError) {
                const errorMsg = `Simulated error occurred ${logInfo}`;
                logger.warn(`[ReqID: ${requestId}] Simulating an error response:`, errorMsg);
                simulatedResult = simulationSendUserMessageResult({
                    status: "error",
                    responses: [{statusText: errorMsg, status: "error"}],
                    includeDefaultAttachment: false
                });
            }
            // Create a simulated success result.
            else {
                logger.debug(`[ReqID: ${requestId}] Simulating a successful response ${logInfo}`);
                const responseMessages = simulatedResponseOverride ?? hookOpts.current.simulationResponses;
                simulatedResult = simulationSendUserMessageResult({
                    responses: responseMessages ? responseMessages.map((m: Partial<Message>) => ({...m})) : undefined,
                    status: "complete"
                });
                logger.debug(`[ReqID: ${requestId}] Simulated success response data:`, simulatedResult);
            }

            // Process the simulated result using the same handler function used for real API responses.
            // This ensures consistent state update logic for both real and simulated scenarios.
            handlePoeResponse(simulatedResult, {requestId});
        }, delay);
    }, [logger, handlePoeResponse]);



    // --- sendToAI Function (Returned to Consumer) ---

    /**
     * Initiates a new AI request to Poe (or simulates one).
     * Tracks the request's state internally and provides updates via the provided callback.
     *
     * @param prompt - The text prompt to send to the AI bot. Must include bot mention (e.g., "@ChatGPT") if required by the bot.
     * @param callback - A function that will be called with `RequestState` updates for this specific request.
     * @param requestOptions - Optional settings specific to this request (e.g., streaming, attachments, simulation override).
     */
    const sendToAI = useCallback((
        prompt: string,
        callback: RequestCallback,
        requestOptions?: RequestOptions
    ): void => {
        const requestId = generateRequestId();
        const {stream = false, openChat = false, attachments, simulatedResponseOverride} = requestOptions ?? {};

        logger.info(`[ReqID: ${requestId}] Initiating new request.`);
        logger.debug(`[ReqID: ${requestId}] Prompt: "${prompt}"`, "Options:", requestOptions);

        const initialState: RequestState = {
            requestId,
            generating: true,
            error: null,
            responses: null,
            status: 'incomplete',
        };

        activeRequests.current.set(requestId, {state: initialState, callback});

        // Immediately invoke the callback with the initial "generating" state.
        // This allows the UI to reflect that the request has started.
        try {
            callback(initialState);
        } catch (callbackError) {
            logger.error(`[ReqID: ${requestId}] Error executing initial request callback:`, callbackError);
        }

        // --- Branch: Simulate or Call Real API ---
        if (globalSimulation) {
            simulateResponse(requestId, callback, initialState, simulatedResponseOverride);
            return;
        }

        // --- Call Actual Poe API ---
        // Check if the Poe API is available on the window object.
        if (typeof window === 'undefined' || !window.Poe) {
            const errorMsg = `[ReqID: ${requestId}] usePoeAi Error: window.Poe is not available. Cannot send message.`;
            logger.error(errorMsg);
            const errorState: RequestState = {...initialState, generating: false, error: errorMsg, status: 'error'};
            activeRequests.current.set(requestId, {state: errorState, callback});

            tryCatchSync(() => callback(errorState)) // Ignore Error, already logged
            // Clean up the failed request immediately.
            activeRequests.current.delete(requestId);
            return;
        }

        // Call the Poe API's sendUserMessage function.
        window.Poe.sendUserMessage(prompt, {
            handler: handlerName,
            stream: stream,
            openChat: openChat,
            attachments: attachments,
            handlerContext: {requestId}
        })
            .then((dispatchResult) => {
                logger.debug(`[ReqID: ${requestId}] Poe.sendUserMessage dispatch result:`, dispatchResult);
                if (!dispatchResult.success && activeRequests.current.has(requestId)) {
                    const errorMsg = `[ReqID: ${requestId}] Poe message dispatch failed immediately (reason unknown).`;
                    logger.error(errorMsg);
                    const errorState: RequestState = {...initialState, generating: false, error: errorMsg, status: 'error'};
                    const entry = activeRequests.current.get(requestId)!;
                    activeRequests.current.set(requestId, {...entry, state: errorState});
                    tryCatchSync(() => entry.callback(errorState)) // Ignore Error, already logged
                    activeRequests.current.delete(requestId);
                }
            })
            .catch(err => {
                let errorMsg = `[ReqID: ${requestId}] Error during message dispatch.`;
                /* v8 ignore next 2 */ // This can not be tested unless we mock the Poe API
                if (err instanceof PoeEmbedAPIError) {
                    errorMsg = `[ReqID: ${requestId}] Poe API Error (${err.errorType}) during dispatch: ${err.message}`;
                } else if (err instanceof Error) {
                    errorMsg = `[ReqID: ${requestId}] Error during message dispatch: ${err.message}`;
                }
                /* v8 ignore next 3 */ // This should never happen, but if it does we handle it
                else {
                    errorMsg = `[ReqID: ${requestId}] An unknown error occurred during message dispatch: ${String(err)}`;
                }
                logger.error(errorMsg, err);

                // If the request is still tracked, update its state to error and notify the callback.
                if (activeRequests.current.has(requestId)) {
                    const errorState: RequestState = {...initialState, generating: false, error: errorMsg, status: 'error'};
                    const entry = activeRequests.current.get(requestId)!;
                    activeRequests.current.set(requestId, {...entry, state: errorState});
                    tryCatchSync(() => entry.callback(errorState)) // Ignore Error, already logged
                    activeRequests.current.delete(requestId);
                }
            });
    }, [logger, globalSimulation, handlerName, simulateResponse]);

    return [sendToAI];
}