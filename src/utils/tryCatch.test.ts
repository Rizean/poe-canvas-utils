// src/utils/tryCatch.test.ts
import { tryCatchSync, tryCatchAsync, Result } from './tryCatch';

describe('tryCatch Utilities', () => {
    // --- Synchronous Tests ---
    describe('tryCatchSync', () => {
        it('should return [data, null] for a successful synchronous function', () => {
            const data = { id: 1, name: 'Test' };
            const fn = (): typeof data => data;
            const result: Result<typeof data, Error> = tryCatchSync(fn); // E defaults to Error
            expect(result).toEqual([data, null]);
            if (result[1] === null) {
                expect(result[0].name).toBe('Test');
            }
        });

        it('should return [null, error] for a failing synchronous function (with Error instance)', () => {
            const error = new Error('Sync error');
            const fn = (): never => {
                throw error;
            };
            const result: Result<never, Error> = tryCatchSync(fn);
            expect(result[0]).toBeNull();
            expect(result[1]).toBe(error); // Should be the same Error instance
            if (result[0] === null) {
                expect(result[1]?.message).toBe('Sync error');
            }
        });

        it('should wrap a non-Error thrown value in an Error instance if no mapError is provided', () => {
            const errorMessageString = 'Sync error as string';
            const fn = (): never => {
                throw errorMessageString; // Throwing a string
            };
            const result = tryCatchSync(fn); // E defaults to Error

            expect(result[0]).toBeNull();
            expect(result[1]).toBeInstanceOf(Error); // Should be wrapped
            expect((result[1] as Error).message).toBe(errorMessageString); // Message should be the original string
        });

        it('should wrap a non-Error (object) thrown value in an Error instance if no mapError is provided', () => {
            const errorObject = { code: 500, description: 'Sync error as object' };
            const fn = (): never => {
                throw errorObject; // Throwing an object
            };
            const result = tryCatchSync(fn); // E defaults to Error

            expect(result[0]).toBeNull();
            expect(result[1]).toBeInstanceOf(Error); // Should be wrapped
            // String(errorObject) is typically "[object Object]"
            expect((result[1] as Error).message).toBe(String(errorObject));
        });


        it('should use mapError for a failing synchronous function (with Error instance)', () => {
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

        it('should use mapError for a failing synchronous function (with non-Error thrown)', () => {
            const originalErrorString = 'Sync original non-error';
            const mappedErrorMessage = 'Mapped sync non-error';
            const fn = (): never => {
                throw originalErrorString;
            };
            // mapError receives the raw thrown value (string in this case)
            const mapError = (err: unknown) => new Error(mappedErrorMessage + ': ' + String(err));
            const result = tryCatchSync(fn, mapError);

            expect(result[0]).toBeNull();
            expect(result[1]).toBeInstanceOf(Error);
            expect((result[1] as Error).message).toBe(`${mappedErrorMessage}: ${originalErrorString}`);
        });
    });

    // --- Asynchronous Tests (Promises) ---
    describe('tryCatchAsync', () => {
        it('should return Promise<[data, null]> for a successful promise', async () => {
            const data = { id: 2, value: 'Async success' };
            const fn = () => Promise.resolve(data);
            const result = await tryCatchAsync(fn);
            expect(result).toEqual([data, null]);
            if (result[1] === null) {
                expect(result[0].value).toBe('Async success');
            }
        });

        it('should return Promise<[null, error]> for a failing promise (with Error instance)', async () => {
            const error = new Error('Async error');
            const fn = () => Promise.reject(error);
            const result = await tryCatchAsync(fn);
            expect(result[0]).toBeNull();
            expect(result[1]).toBe(error); // Should be the same Error instance
            if (result[0] === null) {
                expect(result[1]?.message).toBe('Async error');
            }
        });

        it('should wrap a non-Error rejected value in an Error instance if no mapError is provided', async () => {
            const rejectMessageString = 'Async error as string';
            const fn = () => Promise.reject(rejectMessageString); // Rejecting with a string
            const result = await tryCatchAsync(fn); // E defaults to Error

            expect(result[0]).toBeNull();
            expect(result[1]).toBeInstanceOf(Error); // Should be wrapped
            expect((result[1] as Error).message).toBe(rejectMessageString);
        });

        it('should wrap a non-Error (object) rejected value in an Error instance if no mapError is provided', async () => {
            const rejectObject = { code: 503, reason: 'Async service unavailable object' };
            const fn = () => Promise.reject(rejectObject); // Rejecting with an object
            const result = await tryCatchAsync(fn); // E defaults to Error

            expect(result[0]).toBeNull();
            expect(result[1]).toBeInstanceOf(Error); // Should be wrapped
            expect((result[1] as Error).message).toBe(String(rejectObject));
        });

        it('should use mapError for a failing promise (with Error instance)', async () => {
            const originalError = new Error('Async original error');
            const mappedErrorMessage = 'Mapped async error';
            const fn = () => Promise.reject(originalError);
            const mapError = (err: unknown) => new Error(mappedErrorMessage + ': ' + (err as Error).message);
            const result = await tryCatchAsync(fn, mapError);

            expect(result[0]).toBeNull();
            expect(result[1]).toBeInstanceOf(Error);
            expect((result[1] as Error).message).toBe(`${mappedErrorMessage}: ${originalError.message}`);
        });

        it('should use mapError for a failing promise (with non-Error rejection)', async () => {
            const originalRejectValue = 'Async original non-error rejection';
            const mappedErrorMessage = 'Mapped async non-error';
            const fn = () => Promise.reject(originalRejectValue);
            const mapError = (err: unknown) => new Error(mappedErrorMessage + ': ' + String(err));
            const result = await tryCatchAsync(fn, mapError);

            expect(result[0]).toBeNull();
            expect(result[1]).toBeInstanceOf(Error);
            expect((result[1]as Error).message).toBe(`${mappedErrorMessage}: ${originalRejectValue}`);
        });

        it('should handle synchronous errors thrown within the async function before promise creation', async () => {
            const error = new Error('Immediate sync error in async fn');
            const fn = (): Promise<string> => {
                throw error;
            };
            const result = await tryCatchAsync(fn);
            expect(result[0]).toBeNull();
            expect(result[1]).toBe(error); // Direct throw, not wrapped if already Error
        });

        it('should handle synchronous non-Error thrown within the async function before promise creation', async () => {
            const errorMsg = 'Immediate sync non-Error in async fn';
            const fn = (): Promise<string> => {
                throw errorMsg; // Throwing a string synchronously
            };
            const result = await tryCatchAsync(fn);
            expect(result[0]).toBeNull();
            expect(result[1]).toBeInstanceOf(Error); // Should be wrapped
            expect((result[1] as Error).message).toBe(errorMsg);
        });
    });

    // --- Type Tests (Conceptual - TypeScript compiler handles this) ---
    describe('Type Safety (Conceptual)', () => {
        it('tryCatchSync provides correct types', () => {
            const syncFnSuccess = () => 42;
            const [dataS, errorS] = tryCatchSync(syncFnSuccess);
            if (errorS === null) {
                expect(typeof dataS).toBe('number');
                expect(dataS).toBe(42);
            }

            const syncFnFailure = (): number => { throw new Error('fail'); };
            const [dataF, errorF] = tryCatchSync(syncFnFailure);
            if (dataF === null) {
                expect(errorF).toBeInstanceOf(Error);
            }
        });

        it('tryCatchAsync provides correct types', async () => {
            const asyncFnSuccess = () => Promise.resolve('hello');
            const [dataS, errorS] = await tryCatchAsync(asyncFnSuccess);
            if (errorS === null) {
                expect(typeof dataS).toBe('string');
                expect(dataS).toBe('hello');
            }

            const asyncFnFailure = (): Promise<string> => Promise.reject(new Error('fail async'));
            const [dataF, errorF] = await tryCatchAsync(asyncFnFailure);
            if (dataF === null) {
                expect(errorF).toBeInstanceOf(Error);
            }
        });
    });
});