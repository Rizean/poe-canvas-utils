// src/hooks/useLogger.test.ts
import { renderHook, act } from '@testing-library/react';
// import useLogger, { LogEntry, Logger } from './useLogger';
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
        jest.useFakeTimers(); // Use fake timers to control Date
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
        const { result } = renderHook(() => useLogger());
        act(() => {
            result.current.logger.debug('Should not be in logs');
            result.current.logger.info('Should be in logs');
        });
        expect(result.current.logs.length).toBe(1);
        expect(result.current.logs[0].type).toBe('info');
        expect(mockConsole.debug).toHaveBeenCalledWith('Should not be in logs'); // Still console logged
        expect(mockConsole.info).toHaveBeenCalledWith('Should be in logs');
    });

    it('should respect the provided logLevel (e.g., "debug")', () => {
        const { result } = renderHook(() => useLogger('debug'));
        act(() => {
            result.current.logger.trace('Should not be in logs');
            result.current.logger.debug('Debug message');
            result.current.logger.info('Info message');
        });
        expect(result.current.logs.length).toBe(2);
        expect(result.current.logs[0].type).toBe('debug');
        expect(result.current.logs[1].type).toBe('info');
        expect(mockConsole.trace).toHaveBeenCalledWith('Should not be in logs');
        expect(mockConsole.debug).toHaveBeenCalledWith('Debug message');
        expect(mockConsole.info).toHaveBeenCalledWith('Info message');
    });

    it('should respect the provided logLevel (e.g., "warn")', () => {
        const { result } = renderHook(() => useLogger('warn'));
        act(() => {
            result.current.logger.info('Info, should not be in logs');
            result.current.logger.warn('Warning message');
            result.current.logger.error('Error message');
        });
        expect(result.current.logs.length).toBe(2);
        expect(result.current.logs[0].type).toBe('warn');
        expect(result.current.logs[1].type).toBe('error');
        expect(mockConsole.info).toHaveBeenCalledWith('Info, should not be in logs');
        expect(mockConsole.warn).toHaveBeenCalledWith('Warning message');
        expect(mockConsole.error).toHaveBeenCalledWith('Error message');
    });

    it('should handle unknown logLevel by defaulting to "info"', () => {
        const { result } = renderHook(() => useLogger('verbose')); // 'verbose' is not a defined level
        act(() => {
            result.current.logger.debug('Debug, should not be in logs');
            result.current.logger.info('Info message, should be in logs');
        });
        expect(result.current.logs.length).toBe(1);
        expect(result.current.logs[0].type).toBe('info');
    });

    it('should add log entries with correct structure and timestamp', () => {
        const testDate = new Date(2024, 0, 15, 10, 30, 0);
        jest.setSystemTime(testDate);

        const { result } = renderHook(() => useLogger('info'));
        act(() => {
            result.current.logger.info('Test log entry', { detail: 'some data' });
        });

        expect(result.current.logs.length).toBe(1);
        const logEntry = result.current.logs[0];
        expect(logEntry.type).toBe('info');
        expect(logEntry.message).toBe('Test log entry  [{"detail":"some data"}]'); // Due to safeStringify
        expect(logEntry.timestamp).toEqual(testDate);
        expect(mockConsole.info).toHaveBeenCalledWith('Test log entry', { detail: 'some data' });
    });

    it('should stringify additional arguments correctly', () => {
        const { result } = renderHook(() => useLogger('debug'));
        const obj = { a: 1, b: { c: 2 } };
        const arr = [1, 'test', true];
        act(() => {
            result.current.logger.debug('Object log:', obj);
            result.current.logger.debug('Array log:', arr);
            result.current.logger.debug('Multiple args:', 'first', 'second', 3);
        });

        expect(result.current.logs[0].message).toBe(`Object log:  [${JSON.stringify(obj)}]`);
        expect(result.current.logs[1].message).toBe(`Array log:  [${JSON.stringify(arr)}]`);
        expect(result.current.logs[2].message).toBe('Multiple args:  ["second",3]');

        expect(mockConsole.debug).toHaveBeenCalledWith('Object log:', obj);
        expect(mockConsole.debug).toHaveBeenCalledWith('Array log:', arr);
        expect(mockConsole.debug).toHaveBeenCalledWith('Multiple args:', 'first', 'second', 3);
    });

    it('should handle non-stringifiable objects in safeStringify gracefully', () => {
        const circularObj: any = {};
        circularObj.self = circularObj;

        const { result } = renderHook(() => useLogger('debug'));
        act(() => {
            result.current.logger.debug('Circular:', circularObj);
        });
        expect(result.current.logs[0].message).toBe('Circular:  [[object Object]]'); // String(circularObj)
        expect(mockConsole.debug).toHaveBeenCalledWith('Circular:', circularObj);
    });


    it('should flush pending logs on re-render/effect', () => {
        const { result, rerender } = renderHook(() => useLogger('info'));

        // Log something, it goes to pendingRef
        act(() => {
            result.current.logger.info('First log');
        });
        expect(result.current.logs.length).toBe(0); // Not yet flushed to state

        // Trigger re-render (which also triggers the useEffect in useLogger)
        rerender();

        expect(result.current.logs.length).toBe(1);
        expect(result.current.logs[0].message).toBe('First log');

        act(() => {
            result.current.logger.warn('Second log');
            result.current.logger.error('Third log');
        });
        expect(result.current.logs.length).toBe(1); // Still old state

        rerender();

        expect(result.current.logs.length).toBe(3);
        expect(result.current.logs[1].message).toBe('Second log');
        expect(result.current.logs[2].message).toBe('Third log');
    });

    it('logger functions should be memoized', () => {
        const { result, rerender } = renderHook(() => useLogger());
        const initialLogger = result.current.logger;
        rerender();
        expect(result.current.logger).toBe(initialLogger); // Expect logger identity to be stable
    });

    it('should call the correct console method for each log type', () => {
        const { result } = renderHook(() => useLogger('trace')); // Lowest level to capture all
        act(() => {
            result.current.logger.trace('trace message');
            result.current.logger.debug('debug message');
            result.current.logger.log('log message');
            result.current.logger.info('info message');
            result.current.logger.warn('warn message');
            result.current.logger.error('error message');
        });

        expect(mockConsole.trace).toHaveBeenCalledWith('trace message');
        expect(mockConsole.debug).toHaveBeenCalledWith('debug message');
        expect(mockConsole.log).toHaveBeenCalledWith('log message');
        expect(mockConsole.info).toHaveBeenCalledWith('info message');
        expect(mockConsole.warn).toHaveBeenCalledWith('warn message');
        expect(mockConsole.error).toHaveBeenCalledWith('error message');
    });
});