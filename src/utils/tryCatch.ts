// src/utils/tryCatch.ts

/**
 * Represents a successful outcome of an operation.
 * Contains the result value of type T and null for the error part.
 * @template T The type of the success value.
 */
export type Success<T> = [T, null];

/**
 * Represents a failed outcome of an operation.
 * Contains null for the result value and an error value of type E.
 * @template E The type of the error value.
 */
export type Failure<E> = [null, E];

/**
 * A discriminated union type representing the result of an operation that can either succeed or fail.
 * If the operation succeeds, it's a Success<T> tuple: [data, null].
 * If the operation fails, it's a Failure<E> tuple: [null, error].
 *
 * @template T The type of the success value.
 * @template E The type of the error value. Defaults to `Error`.
 */
export type Result<T, E = Error> = Success<T> | Failure<E>;

/**
 * Wraps a synchronous function in a try-catch block and returns a Result tuple.
 * This utility function converts thrown errors into a predictable [null, error] tuple format.
 *
 * @template T The expected type of the data if the function executes successfully.
 * @template E The desired type of the error if the function throws. Defaults to `Error`.
 *
 * @param {() => T} fn The synchronous function to wrap.
 * @param {(caughtError: unknown) => E} [mapError] An optional function to transform the caught error.
 * @returns {Result<T, E>} A Result tuple:
 *   - `[data, null]` if the function executes successfully.
 *   - `[null, error]` if the function throws an error.
 */
export function tryCatchSync<T, E = Error>( // Changed default for E
    fn: () => T,
    mapError?: (caughtError: unknown) => E
): Result<T, E> {
    try {
        const data = fn();
        return [data, null];
    } catch (error) {
        // If mapError is not provided, and E is Error, we assert 'error as E'.
        // This is generally safe if we assume caught errors are Error instances.
        // If 'error' is not an Error instance (e.g., a string was thrown),
        // and E is Error, then 'error as E' is a potentially unsafe cast for properties like .message
        // A more robust default error handling without mapError might be to wrap non-Error exceptions.
        // However, for simplicity and common usage, 'error as E' is often acceptable.
        // Alternatively, if E is Error, and error is not an instance of Error, create a new Error(String(error)).
        let finalError: E;
        if (mapError) {
            finalError = mapError(error);
        } else {
            if (error instanceof Error) {
                finalError = error as E; // Safe if E is Error or a supertype
            } else {
                // If E is Error (default) and caught error is not an Error instance, wrap it.
                // This makes the default E=Error safer.
                finalError = new Error(String(error)) as E;
            }
        }
        return [null, finalError];
    }
}

/**
 * Wraps a function that returns a Promise and returns a Promise that always resolves to a Result tuple.
 * This utility function prevents promise rejections from bubbling up, converting them
 * into a predictable [null, error] tuple format.
 *
 * @template T The expected type of the data if the promise resolves successfully.
 * @template E The desired type of the error if the promise rejects. Defaults to `Error`.
 *
 * @param {() => Promise<T>} fn The function that returns a Promise to wrap.
 * @param {(caughtError: unknown) => E} [mapError] An optional function to transform the caught error.
 * @returns {Promise<Result<T, E>>} A Promise that resolves to:
 *   - `[data, null]` if the input promise resolves successfully.
 *   - `[null, error]` if the input promise rejects.
 */
export async function tryCatchAsync<T, E = Error>( // Changed default for E
    fn: () => Promise<T>,
    mapError?: (caughtError: unknown) => E
): Promise<Result<T, E>> {
    try {
        const data = await fn();
        return [data, null];
    } catch (error) {
        let finalError: E;
        if (mapError) {
            finalError = mapError(error);
        } else {
            if (error instanceof Error) {
                finalError = error as E;
            } else {
                finalError = new Error(String(error)) as E;
            }
        }
        return [null, finalError];
    }
}