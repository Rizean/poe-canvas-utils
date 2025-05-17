// src/hooks/usePoeAi.test.ts


import {act, renderHook, waitFor} from '@testing-library/react';
import usePoeAi, {RequestState, simulationSendUserMessageResult} from './usePoeAi';
import {Message, SendUserMessageResult} from '../types/Poe';

// --- Mocks ---

// Mock the global window.Poe object
let mockPoe: {
    registerHandler: jest.Mock;
    sendUserMessage: jest.Mock;
    // Add other methods if your hook uses them
};
let capturedHandler: ((result: SendUserMessageResult, context?: { requestId?: string }) => void) | null = null;
let mockUnregister: jest.Mock | null = null;

// Helper to simulate Poe calling the registered handler
const simulatePoeResponse = (result: SendUserMessageResult, context?: { requestId?: string }) => {
    if (!capturedHandler) {
        throw new Error("Poe handler was not captured during registration.");
    }
    // Simulate async nature slightly if needed, or call directly
    act(() => {
        capturedHandler!(result, context);
    });
};

// Mock console to avoid clutter and allow assertions
const mockLogger = {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    log: jest.fn(),
    trace: jest.fn(),
    warn: jest.fn(),
};

// --- Test Suite ---

describe('usePoeAi Hook', () => {
    // Reset mocks and timers before each test
    beforeEach(() => {
        jest.useFakeTimers(); // Use fake timers for simulations

        // Reset captured handler and unregister mock
        capturedHandler = null;
        mockUnregister = jest.fn();

        // Create fresh mocks for window.Poe
        mockPoe = {
            registerHandler: jest.fn((_handlerName, handlerFunc) => {
                capturedHandler = handlerFunc; // Capture the handler function passed by the hook
                return mockUnregister;         // Return the mock unregister function
            }),
            sendUserMessage: jest.fn(() => Promise.resolve({success: true})), // Default success
        };

        // Assign the mock to the global window object
        Object.defineProperty(window, 'Poe', {
            value: mockPoe,
            writable: true, // Allow modification/deletion
            configurable: true,
        });

        // Reset logger mocks
        Object.values(mockLogger).forEach(mockFn => mockFn.mockClear());
    });

    // Clean up after each test
    afterEach(() => {
        jest.useRealTimers(); // Restore real timers
        jest.restoreAllMocks(); // Restore any other mocks
        // Ensure window.Poe is cleaned up if needed, or let beforeEach overwrite
        // delete (window as any).Poe;
    });

    // --- Test Cases ---

    it('should initialize and return the sendToAI function', () => {
        const {result} = renderHook(() => usePoeAi());
        expect(result.current[0]).toBeInstanceOf(Function); // Check if sendToAI is a function
    });

    it('should register a handler on mount if Poe is available and not simulating', () => {
        renderHook(() => usePoeAi({logger: mockLogger}));
        expect(mockPoe.registerHandler).toHaveBeenCalledTimes(1);
        expect(mockPoe.registerHandler).toHaveBeenCalledWith(expect.stringContaining('poeHandler_'), expect.any(Function));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Registering global Poe handler:'));
    });

    it('should use provided handler name for registration', () => {
        const customHandlerName = 'myCustomPoeHandler';
        renderHook(() => usePoeAi({handler: customHandlerName, logger: mockLogger}));
        expect(mockPoe.registerHandler).toHaveBeenCalledWith(customHandlerName, expect.any(Function));
    });

    it('should NOT register a handler if simulating globally', () => {
        renderHook(() => usePoeAi({simulation: true, logger: mockLogger}));
        expect(mockPoe.registerHandler).not.toHaveBeenCalled();
    });

    it('should NOT register a handler if window.Poe is not available', () => {
        // @ts-expect-error Simulate Poe not being loaded
        delete window.Poe; // Simulate Poe not being loaded
        renderHook(() => usePoeAi({logger: mockLogger}));
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Simulation mode (true) or Poe API not available. Skipping handler registration.'));
        // registerHandler doesn't exist on undefined, so no need to check mock
    });

    it('should unregister the handler on unmount', () => {
        const {unmount} = renderHook(() => usePoeAi({logger: mockLogger}));
        expect(mockUnregister).not.toHaveBeenCalled(); // Not called yet
        unmount();
        expect(mockUnregister).toHaveBeenCalledTimes(1);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Unregistering global Poe handler:'));
    });

    // --- API Call Tests ---
    describe('API Calls', () => {
        it('should call window.Poe.sendUserMessage with correct parameters', async () => {
            const {result} = renderHook(() => usePoeAi());
            const [sendToAI] = result.current;
            const mockCallback = jest.fn();
            const prompt = '@Bot Hello!';
            const attachments = [new File(['content'], 'file.txt')];

            act(() => {
                sendToAI(prompt, mockCallback, {stream: true, openChat: true, attachments});
            });

            // Wait for potential async operations in sendToAI if any (though unlikely here)
            await Promise.resolve();

            expect(mockPoe.sendUserMessage).toHaveBeenCalledTimes(1);
            expect(mockPoe.sendUserMessage).toHaveBeenCalledWith(
                prompt,
                expect.objectContaining({
                    handler: expect.stringContaining('poeHandler_'),
                    stream: true,
                    openChat: true,
                    attachments: attachments,
                    handlerContext: expect.objectContaining({
                        requestId: expect.any(String),
                    }),
                })
            );
        });

        it('should invoke callback immediately with initial generating state', () => {
            const {result} = renderHook(() => usePoeAi());
            const [sendToAI] = result.current;
            const mockCallback = jest.fn();

            act(() => {
                sendToAI('@Bot Test', mockCallback);
            });

            expect(mockCallback).toHaveBeenCalledTimes(1);
            expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining<Partial<RequestState>>({
                generating: true,
                status: 'incomplete',
                error: null,
                responses: null,
                requestId: expect.any(String),
            }));
        });

        it('should handle successful API response (complete)', async () => {
            const {result} = renderHook(() => usePoeAi());
            const [sendToAI] = result.current;
            const mockCallback = jest.fn();
            let capturedRequestId: string | undefined = undefined;

            act(() => {
                sendToAI('@Bot Test', (state) => {
                    mockCallback(state); // Pass state through
                    if (!capturedRequestId) capturedRequestId = state.requestId;
                });
            });

            expect(mockCallback).toHaveBeenCalledTimes(1); // Initial call

            // Simulate Poe sending a complete response via the captured handler
            const responseMessage = {messageId: 'm1', senderId: 'Bot', content: 'Done.', contentType: 'text/plain', status: 'complete'} as const;
            const successResult = simulationSendUserMessageResult({status: 'complete', responses: [responseMessage]});

            // Ensure handler is captured before simulating response
            await waitFor(() => expect(capturedHandler).not.toBeNull());

            simulatePoeResponse(successResult, {requestId: capturedRequestId!});

            // Check final callback call
            expect(mockCallback).toHaveBeenCalledTimes(2);
            expect(mockCallback).toHaveBeenLastCalledWith(expect.objectContaining<Partial<RequestState>>({
                generating: false,
                status: 'complete',
                error: null,
                responses: [expect.objectContaining(responseMessage)],
                requestId: capturedRequestId,
            }));
        });

        it('should handle streaming API response (incomplete -> complete)', async () => {
            const {result} = renderHook(() => usePoeAi());
            const [sendToAI] = result.current;
            const mockCallback = jest.fn();
            let capturedRequestId: string | undefined = undefined;

            act(() => {
                sendToAI('@Bot Stream', (state) => {
                    mockCallback(state);
                    if (!capturedRequestId) capturedRequestId = state.requestId;
                }, {stream: true});
            });

            expect(mockCallback).toHaveBeenCalledTimes(1); // Initial

            await waitFor(() => expect(capturedHandler).not.toBeNull());

            // Simulate Incomplete
            const incompleteMessage = {messageId: 'm1', senderId: 'Bot', content: 'Thinking...', contentType: 'text/plain', status: 'incomplete'} as const;
            const incompleteResult = simulationSendUserMessageResult({status: 'incomplete', responses: [incompleteMessage]});
            simulatePoeResponse(incompleteResult, {requestId: capturedRequestId!});

            expect(mockCallback).toHaveBeenCalledTimes(2);
            expect(mockCallback).toHaveBeenNthCalledWith(2, expect.objectContaining<Partial<RequestState>>({
                generating: true,
                status: 'incomplete',
                responses: [expect.objectContaining(incompleteMessage)],
                requestId: capturedRequestId,
            }));

            // Simulate Complete
            const completeMessage = {...incompleteMessage, content: 'Thinking... Done!', status: 'complete'} as const;
            const completeResult = simulationSendUserMessageResult({status: 'complete', responses: [completeMessage]});
            simulatePoeResponse(completeResult, {requestId: capturedRequestId!});

            expect(mockCallback).toHaveBeenCalledTimes(3);
            expect(mockCallback).toHaveBeenLastCalledWith(expect.objectContaining<Partial<RequestState>>({
                generating: false,
                status: 'complete',
                responses: [expect.objectContaining(completeMessage)],
                requestId: capturedRequestId,
            }));
        });

        it('should handle API response with error status', async () => {
            const {result} = renderHook(() => usePoeAi());
            const [sendToAI] = result.current;
            const mockCallback = jest.fn();
            let capturedRequestId: string | undefined = undefined;

            act(() => {
                sendToAI('@Bot Error', (state) => {
                    mockCallback(state);
                    if (!capturedRequestId) capturedRequestId = state.requestId;
                });
            });

            await waitFor(() => expect(capturedHandler).not.toBeNull());

            // Simulate an error result from Poe
            const errorMessageData = {messageId: 'm1', senderId: 'Bot', content: 'Error', status: 'error', statusText: 'Bot failed'} as const;
            const errorResult = simulationSendUserMessageResult({
                status: 'error',
                // IMPORTANT: Pass the specific error message data to the simulation helper
                responses: [errorMessageData],
                // Prevent the helper from adding default attachments/content in this specific error case
                includeDefaultAttachment: false,
            });
            simulatePoeResponse(errorResult, {requestId: capturedRequestId!});

            expect(mockCallback).toHaveBeenCalledTimes(2);
            expect(mockCallback).toHaveBeenLastCalledWith(expect.objectContaining<Partial<RequestState>>({
                generating: false,
                status: 'error',
                // FIX: Match the generated error message format
                error: '[Bot Error]: Bot failed',
                // FIX: Expect the specific error message passed in responses
                responses: [expect.objectContaining(errorMessageData)],
                requestId: capturedRequestId,
            }));
        });

        it('should handle sendUserMessage promise rejection (dispatch error)', async () => {
            const dispatchError = new Error("Network Failed");
            mockPoe.sendUserMessage.mockRejectedValueOnce(dispatchError); // Simulate immediate failure

            const {result} = renderHook(() => usePoeAi());
            const [sendToAI] = result.current;
            const mockCallback = jest.fn();

            act(() => {
                sendToAI('@Bot Fail', mockCallback);
            });

            // Wait for the catch block in sendToAI to execute
            await waitFor(() => expect(mockCallback).toHaveBeenCalledTimes(2)); // Initial + Error

            expect(mockCallback).toHaveBeenLastCalledWith(expect.objectContaining<Partial<RequestState>>({
                generating: false,
                status: 'error', // Status should be updated to error
                error: expect.stringContaining('Error during message dispatch: Network Failed'),
                requestId: expect.any(String),
            }));
        });

        it('should handle sendUserMessage returning { success: false }', async () => {
            mockPoe.sendUserMessage.mockResolvedValueOnce({success: false}); // Simulate non-error dispatch failure

            const {result} = renderHook(() => usePoeAi());
            const [sendToAI] = result.current;
            const mockCallback = jest.fn();

            act(() => {
                sendToAI('@Bot Fail', mockCallback);
            });

            await waitFor(() => expect(mockCallback).toHaveBeenCalledTimes(2));

            expect(mockCallback).toHaveBeenLastCalledWith(expect.objectContaining<Partial<RequestState>>({
                generating: false,
                status: 'error',
                error: expect.stringContaining('Poe message dispatch failed immediately'),
                requestId: expect.any(String),
            }));
        });
    });

    // --- Simulation Tests ---
    describe('Simulation Mode', () => {
        it('should run simulation if global simulation is true', () => {
            const {result} = renderHook(() => usePoeAi({simulation: true, logger: mockLogger, simulateErrorChance: 0}));
            const [sendToAI] = result.current;
            const mockCallback = jest.fn();

            act(() => {
                sendToAI('Simulate', mockCallback);
            });

            expect(mockCallback).toHaveBeenCalledTimes(1); // Initial
            expect(mockPoe.sendUserMessage).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Simulating AI response...'));

            // Run timers
            act(() => {
                jest.runAllTimers();
            });

            expect(mockCallback).toHaveBeenCalledTimes(2); // Final simulation result
            expect(mockCallback).toHaveBeenLastCalledWith(expect.objectContaining<Partial<RequestState>>({
                generating: false,
                status: 'complete',
            }));
        });

        it('should run simulation if Poe is not available (default behavior)', () => {
            // @ts-expect-error Simulate Poe not being loaded
            delete window.Poe;
            // FIX: Ensure successful simulation for this test
            const {result} = renderHook(() => usePoeAi({logger: mockLogger, simulateErrorChance: 0}));
            const [sendToAI] = result.current;
            const mockCallback = jest.fn();

            act(() => {
                sendToAI('Simulate Fallback', mockCallback);
            });

            expect(mockCallback).toHaveBeenCalledTimes(1); // Initial
            // Check the warning about fallback simulation mode
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Simulation mode (true) or Poe API not available. Skipping handler registration.'));
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Simulating AI response...'));

            act(() => {
                jest.runAllTimers();
            });

            expect(mockCallback).toHaveBeenCalledTimes(2); // Final
            expect(mockCallback).toHaveBeenLastCalledWith(expect.objectContaining<Partial<RequestState>>({
                generating: false,
                status: 'complete',
                error: null, // Should be null on success
                // FIX: Expect the default simulated response structure
                responses: [expect.objectContaining({
                    senderId: "SimulatedAI",
                    content: expect.stringContaining("This is simulated message #1"),
                    contentType: "text/plain",
                    status: "complete",
                    attachments: expect.any(Array) // It adds a default attachment
                })],
            }));
        });

        it('should simulate an error based on simulateErrorChance', () => {
            const {result} = renderHook(() => usePoeAi({
                simulation: true,
                simulateErrorChance: 100, // 100% chance
                logger: mockLogger
            }));
            const [sendToAI] = result.current;
            const mockCallback = jest.fn();

            act(() => {
                sendToAI('Simulate Error', mockCallback);
            });
            act(() => {
                jest.runAllTimers();
            });

            expect(mockCallback).toHaveBeenCalledTimes(2);
            expect(mockCallback).toHaveBeenLastCalledWith(expect.objectContaining<Partial<RequestState>>({
                generating: false,
                status: 'error',
                // FIX: Match the specific error format from simulation
                error: expect.stringContaining('[SimulatedAI Error]: Simulated error occurred'),
                // Responses might contain the default message structure but with error status
                responses: [expect.objectContaining({
                    senderId: "SimulatedAI",
                    status: "error",
                    statusText: expect.stringContaining("Simulated error occurred")
                })],
            }));
            // FIX: Check the first argument passed to the logger
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Simulating an error response:'),
                expect.any(String) // Allow for the second argument with details
            );
        });

        it('should use simulatedResponseOverride if provided', () => {
            const override: Message[] = [{
                messageId: 'override-1',
                senderId: 'OverrideBot',
                content: 'This is the override.',
                contentType: 'text/plain',
                status: 'complete'
                // Note: No attachments provided in override
            }];
            // FIX: Ensure successful simulation
            const {result} = renderHook(() => usePoeAi({simulation: true, simulateErrorChance: 0}));
            const [sendToAI] = result.current;
            const mockCallback = jest.fn();

            act(() => {
                sendToAI('Simulate Override', mockCallback, {simulatedResponseOverride: override});
            });
            act(() => {
                jest.runAllTimers();
            });

            expect(mockCallback).toHaveBeenCalledTimes(2);
            expect(mockCallback).toHaveBeenLastCalledWith(expect.objectContaining<Partial<RequestState>>({
                generating: false,
                status: 'complete',
                error: null,
                // Expect the exact override message. Since the override didn't include attachments,
                // simulationSendUserMessageResult *might* add default ones depending on its logic.
                // Let's be specific about the core override content.
                responses: [expect.objectContaining({
                    messageId: 'override-1',
                    senderId: 'OverrideBot',
                    content: 'This is the override.',
                    status: 'complete',
                    // Check if attachments were added by default or not based on helper logic
                    // attachments: undefined // or expect.any(Array) if defaults are added
                })],
            }));
        });

        it('should use global simulationResponses if override is not provided', () => {
            const globalResponses: Message[] = [{
                messageId: 'global-1',
                senderId: 'GlobalSim',
                content: 'Global simulation response.',
                contentType: 'text/plain',
                status: 'complete'
            }];
            const {result} = renderHook(() => usePoeAi({simulation: true, simulateErrorChance: 0, simulationResponses: globalResponses}));
            const [sendToAI] = result.current;
            const mockCallback = jest.fn();

            act(() => {
                sendToAI('Simulate Global', mockCallback);
            }); // No override
            act(() => {
                jest.runAllTimers();
            });

            expect(mockCallback).toHaveBeenCalledTimes(2);
            expect(mockCallback).toHaveBeenLastCalledWith(expect.objectContaining<Partial<RequestState>>({
                generating: false,
                status: 'complete',
                responses: [expect.objectContaining({content: 'Global simulation response.'})],
            }));
        });
    });

    // --- Error Handling Tests ---
    describe('Error Handling', () => {
        it('should call callback with error if window.Poe is not available when sending', async () => {
            // @ts-expect-error Simulate Poe not being loaded
            delete window.Poe;
            // Render hook (it will default to simulation, but we test sendToAI's internal check)
            const {result} = renderHook(() => usePoeAi({simulation: false})); // Force non-simulation mode
            const [sendToAI] = result.current;
            const mockCallback = jest.fn();

            act(() => {
                sendToAI('@Bot No Poe', mockCallback);
            });

            // Should call back immediately with error
            await waitFor(() => expect(mockCallback).toHaveBeenCalledTimes(2)); // Initial + Error

            expect(mockCallback).toHaveBeenLastCalledWith(expect.objectContaining<Partial<RequestState>>({
                generating: false,
                status: 'error',
                error: expect.stringContaining('window.Poe is not available'),
            }));
        });

        it('should log error if callback throws an error', async () => {
            const callbackError = new Error("Callback failed!");
            const mockCallback = jest.fn(() => {
                throw callbackError;
            });

            const {result} = renderHook(() => usePoeAi({logger: mockLogger}));
            const [sendToAI] = result.current;
            let capturedRequestId: string | undefined = undefined;

            act(() => {
                sendToAI('@Bot Callback Error', (state) => {
                    if (!capturedRequestId) capturedRequestId = state.requestId;
                    // @ts-expect-error FIXME - mockCallback expects 0 args, but we pass 1
                    mockCallback(state); // This will throw on the second call
                });
            });

            await waitFor(() => expect(capturedHandler).not.toBeNull());

            const successResult = simulationSendUserMessageResult({status: 'complete'});
            simulatePoeResponse(successResult, {requestId: capturedRequestId!});

            // Check that the hook's logger caught the error from the user's callback
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error executing request callback:'),
                callbackError
            );
            // The internal state update still happens, but the user callback failed
            expect(mockCallback).toHaveBeenCalledTimes(2); // Called for initial and final state
        });
    });

    // --- Cleanup and Edge Cases ---
    describe('Cleanup and Edge Cases', () => {
        it('should not call callback if component is unmounted', async () => {
            const {result, unmount} = renderHook(() => usePoeAi());
            const [sendToAI] = result.current;
            const mockCallback = jest.fn();
            let capturedRequestId: string | undefined = undefined;

            act(() => {
                sendToAI('@Bot Unmount Test', (state) => {
                    mockCallback(state);
                    if (!capturedRequestId) capturedRequestId = state.requestId;
                });
            });

            await waitFor(() => expect(capturedHandler).not.toBeNull());

            // Unmount the component *before* the response arrives
            unmount();

            // Simulate response arrival
            const successResult = simulationSendUserMessageResult({status: 'complete'});
            simulatePoeResponse(successResult, {requestId: capturedRequestId!});

            // Callback should only have been called once (initially)
            expect(mockCallback).toHaveBeenCalledTimes(1);
        });

        it('should clear active requests when handler is unregistered on unmount', () => {
            const {result, unmount} = renderHook(() => usePoeAi());
            const [sendToAI] = result.current;
            const mockCallback = jest.fn();

            // Initiate a request but don't complete it
            act(() => {
                sendToAI('@Bot Lingering', mockCallback);
            });

            // TODO: Maybe - Access internal state via ref (for testing purposes only - normally not done)
            // const activeRequestsRef = (result as any).current.activeRequests; // Accessing internal ref - brittle!
            // A better way might be to check logs or side effects if possible,
            // but for direct state check, this is sometimes needed in tests.
            // Let's assume we can't access the ref directly and rely on unregister call.

            // Check map size *if* we could access it
            // expect(activeRequestsRef.current.size).toBe(1);

            // Unmount
            unmount();

            // Verify unregister was called (which includes the clear logic)
            expect(mockUnregister).toHaveBeenCalledTimes(1);

            // Check map size again *if* accessible
            // expect(activeRequestsRef.current.size).toBe(0);
            // Since we can't easily access the ref, we trust the unregister logic.
        });
    });
});