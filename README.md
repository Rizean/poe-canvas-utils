# Poe.com Canvas Utils

[![codecov](https://codecov.io/gh/Rizean/poe-canvas-utils/graph/badge.svg?token=YUYY0IKPAX)](https://codecov.io/gh/Rizean/poe-canvas-utils)

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

### 2. `usePoeAiTextGenerator` - Interacting with Poe AI Text Generator Models

This hook is a specialized version of `usePoeAi` tailored for text generation use cases. It always streams responses and simplifies handling of text content, with optional parsing.

```tsx
// MyTextGeneratorComponent.tsx
import React, { useState, useCallback } from 'react';
import {
    usePoeAiTextGenerator,
    type TextRequestState,
    type TextRequestCallback,
    type Result // For custom parser
} from '@rizean/poe-canvas-utils';

// Optional: Define a type for your parsed data if using a parser
interface MyParsedData {
  summary: string;
  keywords: string[];
}

// Optional: Define a custom parser function
const myCustomParser = (text: string): Result<MyParsedData, Error> => {
  try {
    // This is a very basic parser example.
    // In a real scenario, you might look for specific structures or use more robust parsing.
    if (text.length < 10) { // Simulate condition where parsing isn't possible yet or fails
        // For incomplete streams, you might return [null, null] or a specific error
        // if you expect more data before parsing is valid.
        // Or, if it's a definitive parse error:
        // return [null, new Error("Text too short to parse meaningful data.")];
    }
    // Let's assume the AI responds with "Summary: [text] Keywords: [kw1, kw2]"
    const summaryMatch = text.match(/Summary: (.*?)( Keywords:|$)/s);
    const keywordsMatch = text.match(/Keywords: (.*)/s);
    const summary = summaryMatch ? summaryMatch[1].trim() : "No summary found.";
    const keywords = keywordsMatch ? keywordsMatch[1].split(',').map(kw => kw.trim()) : [];

    if (!summaryMatch && !keywordsMatch && text.length > 0) {
        // If no specific structure is found, but there's text,
        // you might decide it's not an error, but just not parseable into MyParsedData.
        // Depending on strictness, you could return an error or a default/empty structure.
    }

    return [{ summary, keywords }, null];
  } catch (e) {
    return [null, e instanceof Error ? e : new Error('Unknown parsing error')];
  }
};

function MyTextGeneratorComponent() {
  const [sendTextPrompt] = usePoeAiTextGenerator<MyParsedData>({
    // simulation: true, // Enable for development
    // logger: console,
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [parsedData, setParsedData] = useState<MyParsedData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGenerateText = useCallback((prompt: string) => {
    setIsGenerating(true);
    setGeneratedText('');
    setParsedData(null);
    setErrorMessage(null);

    const callback: TextRequestCallback<MyParsedData> = (state) => {
      // console.log('Text Generator State:', state);
      setGeneratedText(state.text); // Always update with the latest raw text stream

      if (state.error) {
        setIsGenerating(false);
        setErrorMessage(state.error);
      } else if (state.parsed) {
        setParsedData(state.parsed);
        // You might set isGenerating to false here if parsing indicates completion,
        // or wait for the generating flag.
      }

      if (!state.generating && !state.error) {
        setIsGenerating(false);
        // Final state, even if parsing didn't yield data or wasn't used.
      }
    };

    // Example: Ensure window.Poe is available or simulation is enabled.
    sendTextPrompt(
      `@Gemini-2.5-Pro-Exp Summarize this and list keywords: ${prompt}`,
      callback,
      {
        parser: myCustomParser, // Provide the parser
        // simulatedResponseOverride: [{ messageId: 'sim1', content: 'Summary: Test. Keywords: A, B', ...}],
      }
    );
  }, [sendTextPrompt]);

  // Basic form for input
  const [inputValue, setInputValue] = useState('');
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      handleGenerateText(inputValue.trim());
    }
  };

  return (
    <div>
      <form onSubmit={handleFormSubmit}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter text to process..."
          disabled={isGenerating}
        />
        <button type="submit" disabled={isGenerating}>
          {isGenerating ? 'Generating...' : 'Generate Text'}
        </button>
      </form>

      {errorMessage && <p style={{ color: 'red' }}>Error: {errorMessage}</p>}

      <h4>Live Text Stream:</h4>
      <pre style={{ whiteSpace: 'pre-wrap', border: '1px solid #ccc', padding: '10px' }}>
        {generatedText || "Waiting for generation..."}
      </pre>

      {parsedData && (
        <div>
          <h4>Parsed Data:</h4>
          <p><strong>Summary:</strong> {parsedData.summary}</p>
          <p><strong>Keywords:</strong> {parsedData.keywords.join(', ')}</p>
        </div>
      )}
    </div>
  );
}

export default MyTextGeneratorComponent;
```

### 3. `usePoeAiMediaGenerator` - Interacting with Poe AI Media Generator Models

This hook is tailored for interactions that primarily result in media attachments (e.g., image generation bots). It defaults to non-streaming.

```tsx
// MyMediaGeneratorComponent.tsx
import React, { useState, useCallback } from 'react';
import {
    usePoeAiMediaGenerator,
    type MediaRequestState,
    type MediaRequestCallback,
    type PoeMessageAttachment // Type for received attachments
} from '@rizean/poe-canvas-utils';

function MyMediaGeneratorComponent() {
  const [sendMediaPrompt] = usePoeAiMediaGenerator({
    // simulation: true,
    // logger: console,
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [attachments, setAttachments] = useState<PoeMessageAttachment[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inputFiles, setInputFiles] = useState<File[]>([]); // For sending attachments

  const handleGenerateMedia = useCallback((prompt: string) => {
    setIsGenerating(true);
    setAttachments([]);
    setErrorMessage(null);

    const callback: MediaRequestCallback = (state) => {
      // console.log('Media Generator State:', state);
      setIsGenerating(state.generating); // Reflect generating state

      if (state.error) {
        setErrorMessage(state.error);
      } else if (state.mediaAttachments.length > 0) {
        setAttachments(state.mediaAttachments);
      }
      // When state.generating becomes false and no error, generation is complete.
    };

    sendMediaPrompt(
      `@ImageCreatorBot Create an image of: ${prompt}`,
      callback,
      {
        attachments: inputFiles, // Send user-selected files with the prompt
        // openChat: true, // Optional
        // simulatedResponseOverride: [{ messageId: 'sim1', attachments: [{ attachmentId: 'a1', name: 'sim.png', url: '...', mimeType: 'image/png' }], ...}]
      }
    );
  }, [sendMediaPrompt, inputFiles]);

  const [inputValue, setInputValue] = useState('');
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      handleGenerateMedia(inputValue.trim());
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setInputFiles(Array.from(event.target.files));
    }
  };

  return (
    <div>
      <form onSubmit={handleFormSubmit}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter media generation prompt..."
          disabled={isGenerating}
        />
        <br />
        <label>
          Optional files to send with prompt:
          <input type="file" multiple onChange={handleFileChange} disabled={isGenerating} />
        </label>
        <br />
        <button type="submit" disabled={isGenerating}>
          {isGenerating ? 'Generating Media...' : 'Generate Media'}
        </button>
      </form>

      {errorMessage && <p style={{ color: 'red' }}>Error: {errorMessage}</p>}

      {attachments.length > 0 && (
        <div>
          <h4>Generated Media:</h4>
          <ul>
            {attachments.map(att => (
              <li key={att.attachmentId}>
                <a href={att.url} target="_blank" rel="noopener noreferrer">{att.name}</a>
                ({att.mimeType})
                {att.mimeType.startsWith('image/') && <img src={att.url} alt={att.name} style={{maxWidth: '200px', display: 'block'}} />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default MyMediaGeneratorComponent;

```

### 4. `useLogger` - Client-Side Logging

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

### 5. `tryCatchSync` and `tryCatchAsync` - Functional Error Handling

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

### 6. `applyGeminiThinkingFilter` - Cleaning AI Output

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

### 7. `saveDataToFile` and `loadDataFromFile` - Data Persistence

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

### 8. `complexResponseParser` - Parsing Complex AI Responses

A utility function to parse structured AI responses that might contain a main textual part enclosed in configurable tags and an optional JSON data block.

```tsx
// complexParserExample.ts
import { complexResponseParser, type ParsedComplexAiResponse, type ComplexParserOptions } from '@rizean/poe-canvas-utils';

const exampleAiResponseDefaultTags = `
Some initial chatter from the AI.
*Thinking...*
> Okay, planning to respond.
<response>
This is the primary textual answer.
It can span multiple lines.
</response>
Follow-up text.
\`\`\`json
{
  "id": 123,
  "status": "completed",
  "details": {
    "itemsProcessed": 5,
    "warnings": ["Low accuracy on item 3"]
  }
}
\`\`\`
Final remarks.
`;

const exampleAiResponseCustomTags = `
AI is starting...
[CHAT_START]
Hello! This is the chat content.
[CHAT_END]
\`\`\`json
{"user": "guest", "session": "xyz789"}
\`\`\`
`;

const exampleAiResponseNoJson = `
<response>
Just a simple text response.
</response>
`;

const exampleAiResponseMalformedJson = `
<response>
Text part is okay.
</response>
\`\`\`json
{ "data": "value", "invalid: json }
\`\`\`
`;

// 1. Using default tags (<response>, </response>)
const [parsedDefault, errorDefault] = complexResponseParser(exampleAiResponseDefaultTags);

if (errorDefault) {
  console.error("Default Parser Error:", errorDefault.message);
} else if (parsedDefault) {
  console.log("Parsed with Default Tags:");
  console.log("  Response:", parsedDefault.response); // "This is the primary textual answer.\nIt can span multiple lines."
  console.log("  Data:", parsedDefault.data);
  // Data: { id: 123, status: "completed", details: { itemsProcessed: 5, warnings: ["Low accuracy on item 3"] } }
}

// 2. Using custom tags
const customOptions: ComplexParserOptions = {
  responseStartTag: "[CHAT_START]",
  responseEndTag: "[CHAT_END]"
};
const [parsedCustom, errorCustom] = complexResponseParser(exampleAiResponseCustomTags, customOptions);

if (errorCustom) {
  console.error("Custom Parser Error:", errorCustom.message);
} else if (parsedCustom) {
  console.log("\nParsed with Custom Tags:");
  console.log("  Response:", parsedCustom.response); // "Hello! This is the chat content."
  console.log("  Data:", parsedCustom.data); // Data: { user: "guest", session: "xyz789" }
}

// 3. Response with no JSON
const [parsedNoJson, errorNoJson] = complexResponseParser(exampleAiResponseNoJson);
if (parsedNoJson) {
  console.log("\nParsed with No JSON:");
  console.log("  Response:", parsedNoJson.response); // "Just a simple text response."
  console.log("  Data exists:", 'data' in parsedNoJson); // false
}

// 4. Response with malformed JSON
const [parsedMalformed, errorMalformed] = complexResponseParser(exampleAiResponseMalformedJson);
if (errorMalformed) {
  console.error("\nMalformed JSON Error:", errorMalformed.message); // Will show JSON parsing error
}

// This parser can be used with usePoeAiTextGenerator:
//
// import { usePoeAiTextGenerator } from '@rizean/poe-canvas-utils';
// import { complexResponseParser, type ParsedComplexAiResponse } from '@rizean/poe-canvas-utils';
//
// const [sendPrompt] = usePoeAiTextGenerator<ParsedComplexAiResponse>();
//
// sendPrompt("query", (state) => {
//   if (state.parsed) {
//     // state.parsed.response
//     // state.parsed.data
//   }
// }, { parser: complexResponseParser });
//
// // To use custom tags with the text generator:
// sendPrompt("query", (state) => { /* ... */ }, {
//   parser: (text) => complexResponseParser(text, { responseStartTag: "[S]", responseEndTag: "[E]" })
// });

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

### `usePoeAiTextGenerator<T = undefined>(options?: UseAiTextOptions)`

-   **Returns**: `[(prompt: string, callback: TextRequestCallback<T>, requestOptions?: TextRequestOptions<T>) => Promise<void>]`
    -   A tuple containing a single function (typically named `sendTextMessage` or `sendTextPrompt`) to initiate text generation requests.
-   **`UseAiTextOptions`**: Extends `PoeUseAiOptions` (the options for the base `usePoeAi` hook). Allows configuring simulation, logger, etc., specifically for this text generator instance.
-   **`TextRequestCallback<T>`**: `(state: TextRequestState<T>) => void`
    -   A callback function invoked with state updates during the text generation lifecycle. `T` is the type of the `parsed` data if a parser is used.
-   **`TextRequestState<T>`**:
    -   `requestId: string`: Unique ID for the request.
    -   `generating: boolean`: True if the AI is still generating text.
    -   `error: string | null`: An error message if an error occurred (from AI or parser).
    -   `text: string`: The raw (or partially streamed) text content from the AI.
    -   `parsed?: T`: The output from the provided `parser` function, if any. `T` is the type of the parsed data.
    -   `rawResponse?: PoeAiRequestState | null`: The raw state object from the underlying `usePoeAi` hook, for debugging or advanced use.
-   **`TextRequestOptions<T>`**:
    -   `simulatedResponseOverride?: PoeMessage[] | null`: Specific simulated messages for this request, overriding global simulation settings.
    -   `parser?: (text: string) => Result<T, Error>`: An optional function to parse the AI's `text` response. It should handle potentially incomplete text (during streaming) and return a `Result` tuple (`[parsedData, null]` on success, or `[null, error]` on failure).

### `usePoeAiMediaGenerator(options?: UseAiMediaOptions)`

-   **Returns**: `[(prompt: string, callback: MediaRequestCallback, requestOptions?: MediaRequestOptions) => Promise<void>]`
    -   A tuple containing a single function (typically named `sendMediaMessage` or `sendMediaPrompt`) to initiate media generation requests.
-   **`UseAiMediaOptions`**: Extends `PoeUseAiOptions`. Allows configuring simulation, logger, etc., for this media generator instance.
-   **`MediaRequestCallback`**: `(state: MediaRequestState) => void`
    -   A callback function invoked with state updates during the media generation lifecycle.
-   **`MediaRequestState`**:
    -   `requestId: string`: Unique ID for the request.
    -   `generating: boolean`: True if the AI is still generating media.
    -   `error: string | null`: An error message if an error occurred.
    -   `mediaAttachments: PoeMessageAttachment[]`: An array of `PoeMessageAttachment` objects representing the generated media.
    -   `rawResponse?: PoeAiRequestState | null`: The raw state object from the underlying `usePoeAi` hook.
-   **`MediaRequestOptions`**:
    -   `simulatedResponseOverride?: PoeMessage[] | null`: Specific simulated messages for this request.
    -   `attachments?: File[]`: An array of `File` objects to send *with* the prompt to the AI.
    -   `openChat?: boolean`: Whether to attempt to open the Poe chat interface (defaults to `false` or as per `usePoeAi` default).



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

### `complexResponseParser(rawText: string, options?: ComplexParserOptions)`

-   **Returns**: `Result<ParsedComplexAiResponse, Error>`
    -   A `Result` tuple: `[ParsedComplexAiResponse, null]` on successful parsing, or `[null, Error]` if an error occurs (e.g., malformed JSON within a declared JSON block).
-   **`rawText: string`**: The raw string output from the AI to be parsed.
-   **`options?: ComplexParserOptions`**:
    -   `responseStartTag?: string`: Custom string marking the beginning of the main response block (defaults to `"<response>"`).
    -   `responseEndTag?: string`: Custom string marking the end of the main response block (defaults to `"</response>"`).
-   **`ParsedComplexAiResponse`** (Interface for the successfully parsed data):
    -   `response: string`: The extracted textual content from between the response tags.
    -   `data?: unknown`: The parsed data from the ` ```json ... ``` ` block, if present and valid. This key is absent if no JSON block is found.

### Poe Types
The library exports various types from `src/types/Poe.ts` (e.g., `PoeMessage`, `PoeMessageAttachment`, `PoeSendUserMessageResult`, `PoeEmbedAPIError`) for strong typing when working with the Poe API. It also augments the global `Window` interface to include `window.Poe`.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request to the [GitHub repository](https://github.com/rizean/poe-canvas-utils).

## License

[Apache-2.0 License](./LICENSE)
