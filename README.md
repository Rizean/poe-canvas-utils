# @your-npm-username/poe-canvas-utils

Utility hooks and types for integrating with the Poe Canvas API and for client-side logging in React applications.

## Features

- `usePoeAi`: A React hook to interact with a Poe AI bot via the Poe Embed API, supporting streaming and simulation.
- `useLogger`: A React hook for client-side logging with different levels and in-memory log storage.
- `tryCatch`: A utility function to wrap synchronous or asynchronous operations for functional error handling.
- `Poe.ts` types: Comprehensive TypeScript definitions for the Poe Embed API.

## Installation

Using pnpm:
```bash
pnpm add @your-npm-username/poe-canvas-utils
```

Using npm:
```bash
npm install @your-npm-username/poe-canvas-utils
```

Using yarn:
```bash
yarn add @your-npm-username/poe-canvas-utils
```

## Usage

```tsx
// Example: Using usePoeAi
import { usePoeAi, type RequestState } from '@your-npm-username/poe-canvas-utils';
import { useEffect } from 'react';

function MyComponent() {
  const [sendToPoe] = usePoeAi({ logger: console }); // Basic console logger

  useEffect(() => {
    const handlePoeUpdate = (state: RequestState) => {
      console.log('Poe AI State:', state);
      if (state.status === 'complete' && state.responses) {
        console.log('AI Response:', state.responses?.content);
      } else if (state.status === 'error') {
        console.error('AI Error:', state.error);
      }
    };

    // Ensure window.Poe is available or simulation is enabled in usePoeAi options
    // Example: sendToPoe("@ChatGPT What is React?", handlePoeUpdate, { stream: true });
  }, [sendToPoe]);

  return <div>Check console for AI interaction.</div>;
}

// Example: Using useLogger
import { useLogger } from '@your-npm-username/poe-canvas-utils';

function LoggerComponent() {
  const { logger, logs } = useLogger('debug'); // Set log level

  useEffect(() => {
    logger.info('Component mounted');
    logger.debug('Some debug information', { data: 123 });
    // logger.error('An example error');
  }, [logger]);

  return (
    <div>
      <h3>Logs:</h3>
      <pre>{JSON.stringify(logs, null, 2)}</pre>
    </div>
  );
}
```

## API

(Detailed API documentation will go here)

### `usePoeAi`
...

### `useLogger`
...

### `tryCatch`
...

### Poe Types
...

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

[Apache-2.0 License](LICENSE)

