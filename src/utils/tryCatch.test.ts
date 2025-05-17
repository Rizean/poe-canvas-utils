// src/utils/tryCatch.test.ts
import { tryCatch } from './tryCatch';

describe('tryCatch Utility', () => {
    // --- Synchronous Tests ---
    describe('Synchronous Operations', () => {
        it('should return [data, null] for a successful synchronous function', () => {
            const data = { id: 1, name: 'Test' };
            const fn = () => data;
            const result = tryCatch(fn);
            expect(result).toEqual([data, null]);
        });

        it('should return [null, error] for a failing synchronous function', () => {
            const error = new Error('Sync error');
            const fn = () => {
                throw error;
            };
            const result = tryCatch(fn);
            expect(result[0]).toBeNull();
            expect(result[1]).toBe(error);
        });

        it('should use mapError for a failing synchronous function', () => {
            const originalError = new Error('Sync original error');
            const mappedErrorMessage = 'Mapped sync error';
            const fn = () => {
                throw originalError;
            };
            const mapError = (err: unknown) => new Error(mappedErrorMessage + ': ' + (err as Error).message);
            const result = tryCatch(fn, mapError);

            expect(result[0]).toBeNull();
            expect(result[1]).toBeInstanceOf(Error);
            expect((result[1] as Error).message).toBe(`${mappedErrorMessage}: ${originalError.message}`);
        });
    });

    // --- Asynchronous Tests (Promises) ---
    describe('Asynchronous Operations (Promises)', () => {
        it('should return Promise<[data, null]> for a successful promise', async () => {
            const data = { id: 2, value: 'Async success' };
            const fn = () => Promise.resolve(data);
            const result = await tryCatch(fn);
            expect(result).toEqual([data, null]);
        });

        it('should return Promise<[null, error]> for a failing promise', async () => {
            const error = new Error('Async error');
            const fn = () => Promise.reject(error);
            const result = await tryCatch(fn);
            expect(result[0]).toBeNull();
            expect(result[1]).toBe(error);
        });

        it('should use mapError for a failing promise', async () => {
            const originalError = new Error('Async original error');
            const mappedErrorMessage = 'Mapped async error';
            const fn = () => Promise.reject(originalError);
            const mapError = (err: unknown) => new Error(mappedErrorMessage + ': ' + (err as Error).message);
            const result = await tryCatch(fn, mapError);

            expect(result[0]).toBeNull();
            expect(result[1]).toBeInstanceOf(Error);
            expect((result[1] as Error).message).toBe(`${mappedErrorMessage}: ${originalError.message}`);
        });

        it('should handle synchronous errors thrown before a promise is returned (less common)', () => {
            // This tests the outer try-catch block in the tryCatch implementation
            const error = new Error('Immediate sync error before promise');
            const fn = () => {
                throw error; // Error thrown before any promise is created/returned
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore - to make TS happy about unreachable code
                return Promise.resolve('unreachable');
            };
            // Since the error is sync, the result is sync
            const result = tryCatch(fn as () => Promise<string>); // Cast to satisfy overload
            expect(result[0]).toBeNull();
            expect(result[1]).toBe(error);
        });
    });

    // --- Type Tests (Conceptual - TypeScript compiler handles this) ---
    // These are more to illustrate the expected type behavior
    it('should have correct types for synchronous success', () => {
        const fn = () => 42;
        const [data, error] = tryCatch(fn);
        if (error === null) {
            // data is number
            const _x: number = data;
            expect(data).toBe(42);
        }
    });

    it('should have correct types for synchronous failure', () => {
        const fn = (): number => { throw new Error('fail'); };
        const [data, error] = tryCatch(fn);
        if (data === null) {
            // error is unknown (or Error if mapped)
            const _e: unknown = error;
            expect(error).toBeInstanceOf(Error);
        }
    });

    it('should have correct types for asynchronous success', async () => {
        const fn = () => Promise.resolve('hello');
        const [data, error] = await tryCatch(fn);
        if (error === null) {
            // data is string
            const _x: string = data;
            expect(data).toBe('hello');
        }
    });

    it('should have correct types for asynchronous failure', async () => {
        const fn = (): Promise<string> => Promise.reject(new Error('fail async'));
        const [data, error] = await tryCatch(fn);
        if (data === null) {
            // error is unknown (or Error if mapped)
            // const _e: unknown = error;
            expect(error).toBeInstanceOf(Error);
        }
    });
});