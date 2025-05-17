// src/index.ts

// ---- usePoeAi ----
export { default as usePoeAi } from './hooks/usePoeAi';
export type {
    RequestState,
    RequestCallback,
    RequestOptions,
    UseAiOptions,
} from './hooks/usePoeAi';
export { simulationSendUserMessageResult } from './hooks/usePoeAi';

// ---- useLogger ----
export { default as useLogger } from './hooks/useLogger';
export type {
    LogEntry,
    Logger,
    UseLoggerReturn,
} from './hooks/useLogger';

// ---- tryCatch ----
export { tryCatchSync, tryCatchAsync } from './utils/tryCatch';
export type { Result, Success, Failure } from './utils/tryCatch'; // Exporting helper types

// ---- geminiFilter ----
export { applyGeminiThinkingFilter } from './utils/geminiFilter';

// ---- storage ----
export { saveDataToFile, loadDataFromFile } from './utils/storage'; // Updated function names
export type { VersionedData, LoadOptions as StorageLoadOptions } from './utils/storage';


// ---- Poe.ts ----
export type {
    Message as PoeMessage,
    MessageAttachment as PoeMessageAttachment,
    ContentType as PoeContentType,
    MessageStatus as PoeMessageStatus,
    SendUserMessageResult as PoeSendUserMessageResult,
    HandlerContext as PoeHandlerContext,
    HandlerFunc as PoeHandlerFunc,
    PoeEmbedAPIErrorType,
} from './types/Poe';
export { PoeEmbedAPIError } from './types/Poe';

// Note: The global Window.Poe augmentation in Poe.ts will apply when the library is imported in a TypeScript project.