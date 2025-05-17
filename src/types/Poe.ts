// src/types/Poe.ts

// Ensures this file is treated as a distinct module with its own scope.
export {};

/**
 * Represents the public interface for the Poe Embed API.
 * This API allows interaction with Poe bots from within an embedded context (like an iframe).
 * It is typically accessed via the global `window.Poe` object.
 */
interface PoeEmbedAPI {
    /** A reference to the PoeEmbedAPIError class for error handling. */
    APIError: typeof PoeEmbedAPIError;

    /**
     * Sends a message from the user to a specified Poe bot.
     * Results and updates are delivered asynchronously via a registered handler function.
     *
     * @param {string} text The message content to send. It's often necessary to mention the target bot using '@BotName' at the beginning of the text.
     * @param {object} [options] Optional parameters to configure the message sending behavior.
     * @param {File[]} [options.attachments] An array of File objects to be included with the message.
     * @param {boolean} [options.stream=false] If true, the registered handler will be invoked multiple times with partial results as tokens arrive. Each result includes the complete message content received so far. If false (default), the handler is invoked only once with the final, complete result.
     * @param {boolean} [options.openChat=true] If true (default), the chat interface for the bot may be opened or brought to focus when the message is sent. Set to false to prevent this behavior.
     * @param {string} [options.handler] The name of the handler function (previously registered using `registerHandler`) to invoke with the message results.
     * @param {HandlerContext<T>} [options.handlerContext] Optional arbitrary data object to be passed along to the handler function when it's invoked. Useful for maintaining state or context between the call site and the handler.
     * @template Stream - A boolean literal type mirroring the `stream` option's value. While present, it doesn't alter the core return type of this method but reflects the intended streaming behavior affecting the handler calls.
     * @template T - The type of the data expected within the `handlerContext` object. Defaults to `unknown`.
     *
     * @returns {Promise<{ success: boolean }>} A promise that resolves shortly after the message is dispatched.
     *          `{ success: true }` indicates the message was successfully sent to the Poe system for processing.
     *          It does *not* indicate that the bot has finished responding. Bot responses are delivered via the handler.
     *          The promise rejects if the message cannot be sent due to initial validation errors, user actions (like rejecting confirmation), or API issues.
     *
     * @throws {PoeEmbedAPIError} INVALID_INPUT - If `text` is not a string or is empty/whitespace.
     * @throws {PoeEmbedAPIError} INVALID_INPUT - If `attachments` is provided but is not an array.
     * @throws {PoeEmbedAPIError} INVALID_INPUT - If any item in the `attachments` array is not a `File` object.
     * @throws {PoeEmbedAPIError} USER_REJECTED_CONFIRMATION - If the action requires user confirmation (e.g., for point usage) and the user explicitly rejects it.
     * @throws {PoeEmbedAPIError} ANOTHER_CONFIRMATION_IS_OPEN - If a confirmation dialog is already open when another action requiring confirmation is triggered.
     * @throws {PoeEmbedAPIError} INVALID_INPUT - Potentially triggered by other unspecified input validation failures.
     * @throws {PoeEmbedAPIError} UNKNOWN - For any other unexpected errors during the initial sending process.
     */
    sendUserMessage<Stream extends boolean, T = unknown>(
        text: string,
        options?: {
            attachments?: File[];
            stream?: Stream;
            openChat?: boolean;
            handler?: string;
            handlerContext?: HandlerContext<T>;
        }
    ): Promise<{ success: boolean }>;

    /**
     * Registers a handler function to receive results and updates from `sendUserMessage` calls.
     * Handlers should be registered *before* calling `sendUserMessage` that targets them.
     * It's recommended to register handlers early in the application lifecycle.
     *
     * @param {string} name The unique name for this handler. This name is used in the `handler` option of `sendUserMessage`.
     * @param {HandlerFunc} func The callback function to execute when a message result is available.
     *
     * @returns {VoidFunction} A function that, when called, will unregister this specific handler. This is useful for cleanup.
     */
    registerHandler(
        name: string,
        func: HandlerFunc
    ): VoidFunction;
}

/**
 * Custom error class for errors originating from the Poe Embed API.
 * Provides an `errorType` property for categorized error handling.
 */
export class PoeEmbedAPIError extends Error {
    /** A string literal indicating the category of the error. */
    errorType!: PoeEmbedAPIErrorType; // Definite assignment assertion: Assumed to be set by internal factory function.
}

/** Represents an attachment included in a bot's message response. */
export type MessageAttachment = {
    /** A unique identifier for the attachment. */
    attachmentId: string;
    /** The MIME type of the attachment (e.g., "image/png", "application/pdf"). */
    mimeType: string;
    /** The URL from which the attachment can be downloaded or viewed. */
    url: string;
    /** Indicates if the attachment is intended for inline display (relevant for images). */
    isInline: boolean;
    /** The original filename of the attachment. */
    name: string;
};

/** Specifies the format of the bot message content. */
export type ContentType =
    | "text/plain"      // Plain text content.
    | "text/markdown";  // Markdown formatted text content.

/** Represents a single message response from a bot. */
export type Message = {
    /** A unique identifier for this specific message. */
    messageId: string;
    /** The identifier or name of the bot that sent this message (e.g., "Assistant", "Claude"). */
    senderId: string;
    /** The textual content of the message received so far. For streaming responses, this updates over time. */
    content: string;
    /** The format of the `content` field. */
    contentType: ContentType;
    /** The current status of this message response. */
    status: MessageStatus;
    /** An optional user-friendly string providing more details about the status, typically used for 'error' status. */
    statusText?: string;
    /** An array of attachments included in this message, if any. */
    attachments?: MessageAttachment[];
};

/** Describes the state of a bot message response being processed. */
export type MessageStatus =
    | "incomplete"  // The response is still streaming in; more content is expected.
    | "complete"    // The response has finished generating successfully.
    | "error";      // An error occurred while generating the response. Check `statusText`.

/** The structure of the result object passed to the registered handler function. */
export type SendUserMessageResult = {
    /** The overall status of the response generation process for this user message. */
    status: MessageStatus;
    /**
     * An array containing the bot message(s) generated in response to the user's input.
     * While often a single message, some scenarios might result in multiple distinct bot responses.
     * For streaming, messages within this array will update from 'incomplete' to 'complete' or 'error'.
     */
    responses: Message[];
};

/**
 * A flexible type for the optional context object passed from `sendUserMessage` to the handler.
 * It's a simple record (object) where keys are strings and values can be of type T.
 * @template T The type of values stored in the context object. Defaults to `unknown`.
 */
export type HandlerContext<T = unknown> = Record<string, T>;

/**
 * Defines the signature for handler functions registered with `registerHandler`.
 *
 * @param {SendUserMessageResult} result The result object containing the status and bot responses.
 * @param {HandlerContext} context The optional context object passed from the corresponding `sendUserMessage` call.
 */
export type HandlerFunc = (
    result: SendUserMessageResult,
    context: HandlerContext
) => void;

/** String literal types representing the categories of errors thrown by the API. */
export type PoeEmbedAPIErrorType =
    | "UNKNOWN"                         // An unexpected or unidentified error occurred.
    | "INVALID_INPUT"                   // Input validation failed (e.g., bad message format, invalid attachments).
    | "USER_REJECTED_CONFIRMATION"      // User explicitly cancelled a required confirmation dialog.
    | "ANOTHER_CONFIRMATION_IS_OPEN";   // An action was blocked because another confirmation dialog was already active.

/**
 * Augments the global `Window` interface to include the `Poe` API object.
 * This provides type safety when accessing `window.Poe`.
 */
declare global {
    interface Window {
        /** The entry point for the Poe Embed API. */
        Poe: PoeEmbedAPI;
    }
}