# Poe.com Canvas Utils

Utility hooks and functions for building applications on the Poe platform, particularly for Poe Canvas Apps. This library provides tools for AI interaction, client-side logging, functional error handling, text filtering, and data persistence via file download/upload.

## Features

-   **`usePoeAi`**: A React hook to interact with a Poe AI bot via the Poe Embed API, supporting streaming, attachments, and a robust simulation mode for development.
-   **`useLogger`**: A React hook for client-side logging with configurable levels and in-memory log storage, useful for debugging within the Poe Canvas environment.
-   **`tryCatchSync` & `tryCatchAsync`**: Utility functions to wrap synchronous or asynchronous operations for functional error handling, returning a `Result` tuple (`[data, null]` or `[null, error]`).
-   **`applyGeminiThinkingFilter`**: A utility function to clean up "Thinking..." artifacts from Gemini AI model responses.
-   **`saveDataToFile` & `loadDataFromFile`**: Utilities to allow users to save application data to a JSON file and load it back, with support for data versioning, migration, and validation.
-   **Poe Types**: Comprehensive TypeScript definitions for the Poe Embed API (`window.Poe`).

## Installation

Replace `@your-npm-username` with the actual package name if published, or use a local path for local development. Assuming it's `@rizean/poe-canvas-utils` as per the project name:

Using pnpm:
```bash
pnpm add @rizean/poe-canvas-utils
```

Using npm:
```bash
npm install @rizean/poe-canvas-utils
```

Using yarn:
```bash
yarn add @rizean/poe-canvas-utils
```

## Usage Examples

### 1. `usePoeAi` - Interacting with Poe Bots

This hook simplifies communication with Poe bots.

```tsx
// MyPoeChatComponent.tsx
import React, { useState, useCallback } from 'react';
import { usePoeAi, type RequestState, type PoeMessage } from '@rizean/poe-canvas-utils';

function MyPoeChatComponent() {
  const [sendToPoe] = usePoeAi({
    // simulation: true, // Enable for development without Poe API
    // logger: console, // Optional: use your own logger or console
  });
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<PoeMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmitPrompt = useCallback((prompt: string) => {
    setIsLoading(true);
    setAiResponse(null);
    setError(null);

    const handlePoeUpdate = (state: RequestState) => {
      console.log('Poe AI State Update:', state);
      if (state.status === 'complete') {
        setIsLoading(false);
        if (state.responses && state.responses.length > 0) {
          setAiResponse(state.responses[state.responses.length -1]); // Get the last message
        }
      } else if (state.status === 'error') {
        setIsLoading(false);
        setError(state.error);
      } else if (state.status === 'incomplete') {
        // Handle streaming updates if stream: true is used
        if (state.responses && state.responses.length > 0) {
          setAiResponse(state.responses[state.responses.length -1]);
        }
      }
    };

    // Example: Ensure window.Poe is available or simulation is enabled.
    // The bot name (e.g., "@Gemini-2.5-Pro-Exp", "@Gemini-2.5-Flash") must be part of the prompt
    // if the bot requires it.
    sendToPoe(`@Gemini-2.5-Pro-Exp ${prompt}`, handlePoeUpdate, {
      // stream: true, // Optional: for streaming responses
      // openChat: false, // Optional: to prevent opening Poe chat UI
    });
  }, [sendToPoe]);

  // Basic form for input
  const [inputValue, setInputValue] = useState('');
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      handleSubmitPrompt(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <div>
      <form onSubmit={handleFormSubmit}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask a Poe bot (e.g., @Gemini-2.5-Pro-Exp What is React?)"
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Thinking...' : 'Send'}
        </button>
      </form>

      {aiResponse && (
        <div>
          <h4>AI Response:</h4>
          <p><strong>Sender:</strong> {aiResponse.senderId}</p>
          <p><strong>Content:</strong></p>
          <pre>{aiResponse.content}</pre>
          {aiResponse.attachments && aiResponse.attachments.length > 0 && (
            <div>
              <strong>Attachments:</strong>
              <ul>
                {aiResponse.attachments.map(att => (
                  <li key={att.attachmentId}><a href={att.url} target="_blank" rel="noopener noreferrer">{att.name}</a></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </div>
  );
}

export default MyPoeChatComponent;
```

### 2. `useLogger` - Client-Side Logging

Useful for debugging your canvas app. Logs are stored in memory.

```tsx
// MyLoggerDemoComponent.tsx
import React, { useEffect } from 'react';
import { useLogger, type LogEntry } from '@rizean/poe-canvas-utils';

function MyLoggerDemoComponent() {
  // Initialize logger, optionally set a log level ('trace', 'debug', 'info', 'warn', 'error')
  // Defaults to 'info' if not specified or invalid.
  const { logger, logs } = useLogger('debug');

  useEffect(() => {
    logger.info('LoggerComponent mounted.', { timestamp: new Date().toLocaleTimeString() });
    logger.debug('This is a debug message with some data:', { userId: 123, action: 'load' });
    logger.warn('A warning message occurred.');
    // logger.error('An example error!', new Error('Something went wrong'));
    logger.trace('This trace message will only show if logLevel is "trace".');
  }, [logger]);

  return (
    <div>
      <h3>Application Logs (In-Memory):</h3>
      {logs.length === 0 ? (
        <p>No logs yet.</p>
      ) : (
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {logs.map((log: LogEntry, index: number) => (
            <li key={index} style={{ marginBottom: '5px', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
              <span style={{ fontWeight: 'bold' }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>
              <span style={{ marginLeft: '8px', color: log.type === 'error' ? 'red' : log.type === 'warn' ? 'orange' : 'inherit' }}>
                [{log.type.toUpperCase()}]
              </span>
              <pre style={{ margin: '0 0 0 10px', display: 'inline-block', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {typeof log.message === 'string' ? log.message : JSON.stringify(log.message)}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default MyLoggerDemoComponent;
```

### 3. `tryCatchSync` and `tryCatchAsync` - Functional Error Handling

Wrap functions to handle errors without traditional try-catch blocks in your main logic.

```tsx
// tryCatchExample.ts
import { tryCatchSync, tryCatchAsync, Result } from '@rizean/poe-canvas-utils';

// Synchronous example
function mightThrowSync(shouldThrow: boolean): string {
  if (shouldThrow) {
    throw new Error("Synchronous error!");
  }
  return "Success!";
}

const [dataSync, errorSync]: Result<string, Error> = tryCatchSync(() => mightThrowSync(true));

if (errorSync) {
  console.error("Caught sync error:", errorSync.message);
} else {
  console.log("Sync result:", dataSync);
}

// Asynchronous example
async function mightRejectAsync(shouldReject: boolean): Promise<string> {
  if (shouldReject) {
    return Promise.reject(new Error("Asynchronous error!"));
  }
  return Promise.resolve("Async Success!");
}

async function runAsyncExample() {
  const [dataAsync, errorAsync]: Result<string, Error> = await tryCatchAsync(() => mightRejectAsync(true));

  if (errorAsync) {
    console.error("Caught async error:", errorAsync.message);
  } else {
    console.log("Async result:", dataAsync);
  }
}

runAsyncExample();
```

### 4. `applyGeminiThinkingFilter` - Cleaning AI Output

Removes "Thinking..." blocks from text generated by Gemini models.

```tsx
// geminiFilterExample.ts
import { applyGeminiThinkingFilter } from '@rizean/poe-canvas-utils';

const rawGeminiOutput = `
Some initial text.
*Thinking...*
> This is part of the thinking process.
> More thinking steps.

This is the actual response after thinking.
`;

const cleanedOutput = applyGeminiThinkingFilter(rawGeminiOutput);
console.log("Raw Output:\n", rawGeminiOutput);
console.log("Cleaned Output:\n", cleanedOutput);
// Expected Cleaned Output:
// "This is the actual response after thinking."
// (Leading/trailing newlines might vary based on exact input)
```

### 5. `saveDataToFile` and `loadDataFromFile` - Data Persistence

Allows users to download their application state as a JSON file and upload it later. This is crucial for Poe Canvas Apps which lack traditional browser storage.

```tsx
// MyDataPersistenceComponent.tsx
import React, { useState, useCallback } from 'react';
import {
    saveDataToFile,
    loadDataFromFile,
    type VersionedData,
    type StorageLoadOptions
} from '@rizean/poe-canvas-utils';

// Define your application's data structure
interface AppDataV1 extends VersionedData {
    version: 1;
    notes: string[];
    settings: { theme: string };
}

interface AppDataV2 extends VersionedData {
    version: 2; // New version
    userNotes: Array<{ id: string; text: string }>; // Changed structure
    preferences: {
        theme: string;
        fontSize: number;
    };
}

// Current version of your app's data
const CURRENT_APP_VERSION = 2;
const DATA_FILENAME = 'my-app-data.json';

function MyDataPersistenceComponent() {
  const [appData, setAppData] = useState<AppDataV2 | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const handleSaveData = useCallback(() => {
    if (!appData) {
      setStatusMessage('No data to save.');
      return;
    }
    const [success, error] = saveDataToFile(DATA_FILENAME, appData);
    if (success) {
      setStatusMessage(`Data saved to ${DATA_FILENAME}!`);
    } else {
      setStatusMessage(`Error saving data: ${error?.message}`);
    }
  }, [appData]);

  const handleLoadData = useCallback(async () => {
    const loadOptions: StorageLoadOptions<AppDataV2> = {
      currentVersion: CURRENT_APP_VERSION,
      migrate: async (loadedUntypedData: any, loadedVersion: number): Promise<AppDataV2> => {
        setStatusMessage(`Migrating data from v${loadedVersion} to v${CURRENT_APP_VERSION}...`);
        if (loadedVersion === 1) {
          // Example: Migrate from V1 to V2
          const oldData = loadedUntypedData as AppDataV1;
          return {
            version: 2,
            userNotes: oldData.notes.map((note, index) => ({ id: `note-${index}`, text: note })),
            preferences: {
              theme: oldData.settings.theme,
              fontSize: 14, // New default
            },
          };
        }
        // If more versions, add more migration steps here
        throw new Error(`Migration from version ${loadedVersion} not supported.`);
      },
      validate: async (dataToValidate: AppDataV2): Promise<boolean> => {
        // Example validation: ensure preferences exist
        const isValid = dataToValidate.preferences && typeof dataToValidate.preferences.theme === 'string';
        if (!isValid) setStatusMessage('Validation failed: Invalid preferences structure.');
        return isValid;
      },
    };

    const [loadedData, error] = await loadDataFromFile<AppDataV2>(loadOptions);

    if (error) {
      setStatusMessage(`Error loading data: ${error.message}`);
      setAppData(null);
    } else if (loadedData) {
      setAppData(loadedData);
      setStatusMessage('Data loaded successfully!');
    } else {
      setStatusMessage('File selection cancelled or no data loaded.');
    }
  }, []);

  // Initialize with some default data for V2
  useEffect(() => {
    setAppData({
        version: CURRENT_APP_VERSION,
        userNotes: [{id: '1', text: "Hello World"}],
        preferences: { theme: 'dark', fontSize: 16}
    });
  }, []);


  return (
    <div>
      <h3>Data Persistence Example</h3>
      <button onClick={handleSaveData} disabled={!appData}>Save Data to File</button>
      <button onClick={handleLoadData}>Load Data from File</button>
      {statusMessage && <p><i>{statusMessage}</i></p>}

      <h4>Current App Data:</h4>
      <pre>{appData ? JSON.stringify(appData, null, 2) : 'No data loaded.'}</pre>
    </div>
  );
}

export default MyDataPersistenceComponent;
```

## API Reference

### `usePoeAi(options?: UseAiOptions)`
-   **Returns**: `[(prompt: string, callback: RequestCallback, requestOptions?: RequestOptions) => void]`
-   `sendToAI` function to initiate requests.
-   **`UseAiOptions`**:
-   `handler?: string`: Custom handler name.
-   `simulation?: boolean`: Enable/disable simulation.
-   `simulationDelay?: number`: Delay for simulated responses.
-   `simulateErrorChance?: number`: Chance of simulated error (0-100).
-   `simulationResponses?: Message[] | null`: Default simulated messages.
-   `logger?: Logger`: Custom logger instance.
-   **`RequestCallback`**: `(state: RequestState) => void`
-   **`RequestState`**: `{ requestId, generating, error, responses, status }`
-   **`RequestOptions`**: `{ stream?, openChat?, simulatedResponseOverride?, attachments? }`

### `useLogger(logLevelInput?: string)`
-   **Returns**: `{ logs: LogEntry[], logger: Logger }`
-   **`logLevelInput`**: `'trace' | 'debug' | 'info' | 'warn' | 'error'` (defaults to `'info'`).
-   **`LogEntry`**: `{ type: string, message: unknown, timestamp: Date }`
-   **`Logger`**: Interface with methods like `debug()`, `info()`, `error()`, etc.

### `tryCatchSync<T, E = Error>(fn: () => T, mapError?: (caughtError: unknown) => E)`
-   **Returns**: `Result<T, E>` which is `[T, null] | [null, E]`

### `tryCatchAsync<T, E = Error>(fn: () => Promise<T>, mapError?: (caughtError: unknown) => E)`
-   **Returns**: `Promise<Result<T, E>>`

### `applyGeminiThinkingFilter(text: string)`
-   **Returns**: `string` (filtered text)

### `saveDataToFile<T extends VersionedData>(filename: string, data: T)`
-   **Returns**: `Result<true, Error>`
-   Triggers a file download.

### `loadDataFromFile<T extends VersionedData>(options: StorageLoadOptions<T>)`
-   **Returns**: `Promise<Result<T | null, Error | null>>`
-   Prompts user for file upload.
-   **`StorageLoadOptions<T>`**:
-   `currentVersion: number`: Your application's current data structure version.
-   `migrate?: (loadedData: any, loadedVersion: number) => T | Promise<T>`: Function to migrate older data structures.
-   `validate?: (data: T) => boolean | Promise<boolean>`: Function to validate loaded (and possibly migrated) data.
-   **`VersionedData`**: Interface `{ version: number; [key: string]: any; }` that your data structure must implement.

### Poe Types
The library exports various types from `src/types/Poe.ts` (e.g., `PoeMessage`, `PoeMessageAttachment`, `PoeSendUserMessageResult`, `PoeEmbedAPIError`) for strong typing when working with the Poe API. It also augments the global `Window` interface to include `window.Poe`.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request to the [GitHub repository](https://github.com/rizean/poe-canvas-utils).

## License

[Apache-2.0 License](./LICENSE)
```