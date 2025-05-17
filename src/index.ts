// src/index.ts

// ---- usePoeAi ----
export { default as usePoeAi } from './hooks/usePoeAi';
export type {
    RequestState,
    RequestCallback,
    RequestOptions,
    UseAiOptions,
} from './hooks/usePoeAi';
export { simulationSendUserMessageResult } from './hooks/usePoeAi'; // If you want to export this helper

// ---- useLogger ----
export { default as useLogger } from './hooks/useLogger';
export type {
    LogEntry,
    Logger,
    UseLoggerReturn,
} from './hooks/useLogger';

// ---- tryCatch ----
export { tryCatch } from './utils/tryCatch';
// We may want to export the types in the future, but for now, we can keep them private.
// export type { Result, Success, Failure } from './utils/tryCatch';

// ---- geminiFilter ----
export { applyGeminiThinkingFilter } from './utils/geminiFilter';

// ---- Poe.ts ----
export type {
    Message as PoeMessage, // Renaming to avoid conflict if consumer has a 'Message' type
    MessageAttachment as PoeMessageAttachment,
    ContentType as PoeContentType,
    MessageStatus as PoeMessageStatus,
    SendUserMessageResult as PoeSendUserMessageResult,
    HandlerContext as PoeHandlerContext,
    HandlerFunc as PoeHandlerFunc,
    PoeEmbedAPIErrorType,
    // PoeEmbedAPI is a global augmentation, but exporting the error class is useful
} from './types/Poe';
export { PoeEmbedAPIError } from './types/Poe';

// Note: The global Window.Poe augmentation in Poe.ts will apply when the library is imported in a TypeScript project.