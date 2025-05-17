// src/utils/tryCatch.test.ts
import { tryCatchSync, tryCatchAsync, Result } from './tryCatch'; // Updated import

describe('tryCatch Utilities', () => {
    // --- Synchronous Tests ---
    describe('tryCatchSync', () => {
        it('should return [data, null] for a successful synchronous function', () => {
            const data = { id: 1, name: 'Test' };
            const fn = (): typeof data => data; // Explicit return type for clarity
            const result: Result<typeof data, unknown> = tryCatchSync(fn);
            expect(result).toEqual([data, null]);
            if (result[0]) { // Type guard
                expect(result[0].name).toBe('Test');
            }
        });

        it('should return [null, error] for a failing synchronous function', () => {
            const error = new Error('Sync error');
            const fn = (): never => { // Function that always throws returns 'never'
                throw error;
            };
            const result: Result<never, Error> = tryCatchSync(fn);
            expect(result[0]).toBeNull();
            expect(result[1]).toBe(error);
            if (result[0] === null) { // Type guard
                expect(result[1].message).toBe('Sync error');
            }
        });

        it('should use mapError for a failing synchronous function', () => {
            const originalError = new Error('Sync original error');
            const mappedErrorMessage = 'Mapped sync error';
            const fn = (): never => {
                throw originalError;
            };
            const mapError = (err: unknown) => new Error(mappedErrorMessage + ': ' + (err as Error).message);
            const result = tryCatchSync(fn, mapError);

            expect(result[0]).toBeNull();
            expect(result[1]).toBeInstanceOf(Error);
            expect((result[1] as Error).message).toBe(`${mappedErrorMessage}: ${originalError.message}`);
        });
    });

    // --- Asynchronous Tests (Promises) ---
    describe('tryCatchAsync', () => {
        it('should return Promise<[data, null]> for a successful promise', async () => {
            const data = { id: 2, value: 'Async success' };
            const fn = () => Promise.resolve(data);
            const result = await tryCatchAsync(fn);
            expect(result).toEqual([data, null]);
            if (result[0]) { // Type guard
                expect(result[0].value).toBe('Async success');
            }
        });

        it('should return Promise<[null, error]> for a failing promise', async () => {
            const error = new Error('Async error');
            const fn = () => Promise.reject(error);
            const result = await tryCatchAsync<null, {message: string}>(fn);
            expect(result[0]).toBeNull();
            expect(result[1]).toBe(error);
            if (result[0] === null) { // Type guard
                expect(result[1]?.message).toBe('Async error');
            }
        });

        it('should use mapError for a failing promise', async () => {
            const originalError = new Error('Async original error');
            const mappedErrorMessage = 'Mapped async error';
            const fn = () => Promise.reject(originalError);
            const mapError = (err: unknown) => new Error(mappedErrorMessage + ': ' + (err as Error).message);
            const result = await tryCatchAsync(fn, mapError);

            expect(result[0]).toBeNull();
            expect(result[1]).toBeInstanceOf(Error);
            expect((result[1] as Error).message).toBe(`${mappedErrorMessage}: ${originalError.message}`);
        });

        it('should handle synchronous errors thrown within the async function before promise creation', async () => {
            // This tests the try-catch block *inside* tryCatchAsync
            const error = new Error('Immediate sync error in async fn');
            const fn = (): Promise<string> => { // Function signature says it returns a Promise
                throw error; // But it throws synchronously before creating/returning one
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore - to make TS happy about unreachable code
                return Promise.resolve('unreachable');
            };
            const result = await tryCatchAsync(fn);
            expect(result[0]).toBeNull();
            expect(result[1]).toBe(error);
        });
    });

    // --- Type Tests (Conceptual - TypeScript compiler handles this) ---
    describe('Type Safety (Conceptual)', () => {
        it('tryCatchSync provides correct types', () => {
            const syncFnSuccess = () => 42;
            const [dataS, errorS] = tryCatchSync(syncFnSuccess);
            if (errorS === null) {
                // const _x: number = dataS; // dataS is number
                expect(dataS).toBe(42);
            }

            const syncFnFailure = (): number => { throw new Error('fail'); };
            const [dataF, errorF] = tryCatchSync(syncFnFailure);
            if (dataF === null) {
                // const _e: unknown = errorF; // errorF is unknown (or Error if mapped)
                expect(errorF).toBeInstanceOf(Error);
            }
        });

        it('tryCatchAsync provides correct types', async () => {
            const asyncFnSuccess = () => Promise.resolve('hello');
            const [dataS, errorS] = await tryCatchAsync(asyncFnSuccess);
            if (errorS === null) {
                // const _x: string = dataS; // dataS is string
                expect(dataS).toBe('hello');
            }

            const asyncFnFailure = (): Promise<string> => Promise.reject(new Error('fail async'));
            const [dataF, errorF] = await tryCatchAsync(asyncFnFailure);
            if (dataF === null) {
                // const _e: unknown = errorF; // errorF is unknown (or Error if mapped)
                expect(errorF).toBeInstanceOf(Error);
            }
        });
    });
});