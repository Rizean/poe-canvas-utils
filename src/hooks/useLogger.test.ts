// src/hooks/useLogger.test.ts
import { renderHook, act } from '@testing-library/react';
import useLogger from './useLogger';

describe('useLogger Hook', () => {
    let mockConsole: {
        log: jest.SpyInstance;
        debug: jest.SpyInstance;
        info: jest.SpyInstance;
        warn: jest.SpyInstance;
        error: jest.SpyInstance;
        trace: jest.SpyInstance;
    };

    beforeEach(() => {
        mockConsole = {
            log: jest.spyOn(console, 'log').mockImplementation(() => {}),
            debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
            info: jest.spyOn(console, 'info').mockImplementation(() => {}),
            warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
            error: jest.spyOn(console, 'error').mockImplementation(() => {}),
            trace: jest.spyOn(console, 'trace').mockImplementation(() => {}),
        };
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    it('should initialize with empty logs and a logger object', () => {
        const { result } = renderHook(() => useLogger());
        expect(result.current.logs).toEqual([]);
        expect(result.current.logger).toBeDefined();
        expect(result.current.logger.info).toBeInstanceOf(Function);
    });

    it('should use "info" as default logLevel if none is provided', () => {
        const { result, rerender } = renderHook(() => useLogger());
        act(() => {
            result.current.logger.debug('Should not be console logged for state');
            result.current.logger.info('Should be in logs');
        });
        act(() => { rerender(); }); // Flush effect

        expect(result.current.logs.length).toBe(1);
        expect(result.current.logs[0].type).toBe('info');
        expect(result.current.logs[0].message).toBe('Should be in logs');
        expect(mockConsole.debug).toHaveBeenCalledWith('Should not be console logged for state');
        expect(mockConsole.info).toHaveBeenCalledWith('Should be in logs');
    });

    it('should respect the provided logLevel (e.g., "debug")', () => {
        const { result, rerender } = renderHook(() => useLogger('debug'));
        act(() => {
            result.current.logger.trace('Should not be in logs state');
            result.current.logger.debug('Debug message');
            result.current.logger.info('Info message');
        });
        act(() => { rerender(); }); // Flush effect

        expect(result.current.logs.length).toBe(2);
        expect(result.current.logs[0].type).toBe('debug');
        expect(result.current.logs[0].message).toBe('Debug message');
        expect(result.current.logs[1].type).toBe('info');
        expect(result.current.logs[1].message).toBe('Info message');
        expect(mockConsole.trace).toHaveBeenCalledWith('Should not be in logs state');
        expect(mockConsole.debug).toHaveBeenCalledWith('Debug message');
        expect(mockConsole.info).toHaveBeenCalledWith('Info message');
    });

    it('should respect the provided logLevel (e.g., "warn")', () => {
        const { result, rerender } = renderHook(() => useLogger('warn'));
        act(() => {
            result.current.logger.info('Info, should not be in logs state');
            result.current.logger.warn('Warning message');
            result.current.logger.error('Error message');
        });
        act(() => { rerender(); }); // Flush effect

        expect(result.current.logs.length).toBe(2);
        expect(result.current.logs[0].type).toBe('warn');
        expect(result.current.logs[0].message).toBe('Warning message');
        expect(result.current.logs[1].type).toBe('error');
        expect(result.current.logs[1].message).toBe('Error message');
        expect(mockConsole.info).toHaveBeenCalledWith('Info, should not be in logs state');
        expect(mockConsole.warn).toHaveBeenCalledWith('Warning message');
        expect(mockConsole.error).toHaveBeenCalledWith('Error message');
    });

    it('should handle unknown logLevel by defaulting to "info"', () => {
        const { result, rerender } = renderHook(() => useLogger('verbose'));
        act(() => {
            result.current.logger.debug('Debug, should not be in logs state');
            result.current.logger.info('Info message, should be in logs');
        });
        act(() => { rerender(); }); // Flush effect

        expect(result.current.logs.length).toBe(1);
        expect(result.current.logs[0].type).toBe('info');
        expect(result.current.logs[0].message).toBe('Info message, should be in logs');
    });

    it('should add log entries with correct structure and timestamp', () => {
        const testDate = new Date(2024, 0, 15, 10, 30, 0);
        jest.setSystemTime(testDate);

        const { result, rerender } = renderHook(() => useLogger('info'));
        const logDetails = { detail: 'some data' };
        act(() => {
            result.current.logger.info('Test log entry', logDetails);
        });
        act(() => { rerender(); }); // Flush effect

        expect(result.current.logs.length).toBe(1);
        const logEntry = result.current.logs[0];
        expect(logEntry.type).toBe('info');
        // With the updated addLog: primary message is 'Test log entry', additional data is [logDetails]
        expect(logEntry.message).toBe(`Test log entry  [${JSON.stringify(logDetails)}]`);
        expect(logEntry.timestamp).toEqual(testDate);
        expect(mockConsole.info).toHaveBeenCalledWith('Test log entry', logDetails);
    });

    it('should stringify additional arguments correctly', () => {
        const { result, rerender } = renderHook(() => useLogger('debug'));
        const obj = { a: 1, b: { c: 2 } };
        const arr = [1, 'test', true];
        act(() => {
            result.current.logger.debug('Object log:', obj);
            result.current.logger.debug('Array log:', arr);
            result.current.logger.debug('Multiple args:', 'first', 'second', 3);
        });
        act(() => { rerender(); }); // Flush effect

        expect(result.current.logs.length).toBe(3);
        // For 'Object log:', obj -> "Object log:" and [obj]
        expect(result.current.logs[0].message).toBe(`Object log:  [${JSON.stringify(obj)}]`);
        // For 'Array log:', arr -> "Array log:" and [arr]
        expect(result.current.logs[1].message).toBe(`Array log:  [${JSON.stringify(arr)}]`);
        // For 'Multiple args:', 'first', 'second', 3 -> "Multiple args:" and ['first', 'second', 3]
        // No, data[0] is 'Multiple args:', data.slice(1) is ['first', 'second', 3]
        // safeStringify(['first', 'second', 3]) is '["first","second",3]'
        expect(result.current.logs[2].message).toBe(`Multiple args:  ${JSON.stringify(['first', 'second', 3])}`);


        expect(mockConsole.debug).toHaveBeenCalledWith('Object log:', obj);
        expect(mockConsole.debug).toHaveBeenCalledWith('Array log:', arr);
        expect(mockConsole.debug).toHaveBeenCalledWith('Multiple args:', 'first', 'second', 3);
    });

    it('should handle non-stringifiable objects in safeStringify gracefully for state logs', () => {
        const circularObj: any = {};
        circularObj.self = circularObj;

        const { result, rerender } = renderHook(() => useLogger('debug'));
        act(() => {
            result.current.logger.debug('Circular:', circularObj);
        });
        act(() => { rerender(); }); // Flush effect

        expect(result.current.logs.length).toBe(1);
        // For 'Circular:', circularObj -> "Circular:" and [circularObj]
        // safeStringify([circularObj]) -> "[object Object]" because JSON.stringify fails
        expect(result.current.logs[0].message).toBe('Circular:  [object Object]');
        expect(mockConsole.debug).toHaveBeenCalledWith('Circular:', circularObj); // Console gets the raw object
    });
// --- New tests for safeStringify coverage ---
    it('safeStringify should handle null and undefined inputs', () => {
        const { result, rerender } = renderHook(() => useLogger('debug'));
        act(() => {
            result.current.logger.debug(null);
            result.current.logger.debug(undefined);
        });
        act(() => { rerender(); });

        expect(result.current.logs.length).toBe(2);
        expect(result.current.logs[0].message).toBe('null');
        expect(result.current.logs[1].message).toBe('undefined');
        expect(mockConsole.debug).toHaveBeenCalledWith(null);
        expect(mockConsole.debug).toHaveBeenCalledWith(undefined);
    });

    it('safeStringify should handle various primitive types', () => {
        const { result, rerender } = renderHook(() => useLogger('debug'));
        const num = 123;
        const boolTrue = true;
        const boolFalse = false;
        const sym = Symbol('testSymbol');
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        const func = () => {};

        act(() => {
            result.current.logger.debug(num);
            result.current.logger.debug(boolTrue);
            result.current.logger.debug(boolFalse);
            result.current.logger.debug(sym);
            result.current.logger.debug(func);
        });
        act(() => { rerender(); });

        expect(result.current.logs.length).toBe(5);
        expect(result.current.logs[0].message).toBe('123');
        expect(result.current.logs[1].message).toBe('true');
        expect(result.current.logs[2].message).toBe('false');
        expect(result.current.logs[3].message).toBe('Symbol(testSymbol)');
        expect(result.current.logs[4].message).toBe('() => { }'); // Or similar string representation of a function

        expect(mockConsole.debug).toHaveBeenCalledWith(num);
        expect(mockConsole.debug).toHaveBeenCalledWith(boolTrue);
        expect(mockConsole.debug).toHaveBeenCalledWith(boolFalse);
        expect(mockConsole.debug).toHaveBeenCalledWith(sym);
        expect(mockConsole.debug).toHaveBeenCalledWith(func);
    });

    // --- New test for addLog with no arguments ---
    it('addLog should handle calls with no arguments (empty data array)', () => {
        const { result, rerender } = renderHook(() => useLogger('info'));
        act(() => {
            result.current.logger.info(); // Call with no arguments
        });
        act(() => { rerender(); });

        expect(result.current.logs.length).toBe(1);
        expect(result.current.logs[0].type).toBe('info');
        expect(result.current.logs[0].message).toBe(''); // As per current addLog logic
        expect(mockConsole.info).toHaveBeenCalledWith(); // Console called with no args
    });
    // --- End of new tests ---

    it('should flush pending logs on re-render/effect (original test logic)', () => {
        const { result, rerender } = renderHook(() => useLogger('info'));

        act(() => {
            result.current.logger.info('First log');
        });
        // Before rerender, logs state is empty, pendingRef has the item
        expect(result.current.logs.length).toBe(0);

        act(() => { rerender(); }); // This rerender triggers the useEffect

        expect(result.current.logs.length).toBe(1);
        expect(result.current.logs[0].message).toBe('First log');

        act(() => {
            result.current.logger.warn('Second log');
            result.current.logger.error('Third log');
        });
        // Before next rerender, logs state has 1 item, pendingRef has 2 new items
        expect(result.current.logs.length).toBe(1);

        act(() => { rerender(); }); // This rerender triggers the useEffect again

        expect(result.current.logs.length).toBe(3); // 1 (old) + 2 (new)
        expect(result.current.logs[1].message).toBe('Second log');
        expect(result.current.logs[2].message).toBe('Third log');
    });

    it('logger functions should be memoized', () => {
        const { result, rerender } = renderHook(() => useLogger());
        const initialLogger = result.current.logger;
        act(() => { rerender(); });
        expect(result.current.logger).toBe(initialLogger);
    });

    it('should call the correct console method for each log type and store in state', () => {
        const { result, rerender } = renderHook(() => useLogger('trace'));
        act(() => {
            result.current.logger.trace('trace message');
            result.current.logger.debug('debug message');
            result.current.logger.log('log message');
            result.current.logger.info('info message');
            result.current.logger.warn('warn message');
            result.current.logger.error('error message');
        });
        act(() => { rerender(); }); // Flush effect

        expect(mockConsole.trace).toHaveBeenCalledWith('trace message');
        expect(mockConsole.debug).toHaveBeenCalledWith('debug message');
        expect(mockConsole.log).toHaveBeenCalledWith('log message');
        expect(mockConsole.info).toHaveBeenCalledWith('info message');
        expect(mockConsole.warn).toHaveBeenCalledWith('warn message');
        expect(mockConsole.error).toHaveBeenCalledWith('error message');

        expect(result.current.logs.length).toBe(6);
        expect(result.current.logs.map(l => l.type)).toEqual(['trace', 'debug', 'log', 'info', 'warn', 'error']);
    });
});