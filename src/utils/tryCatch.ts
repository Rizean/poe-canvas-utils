// src/utils/tryCatch.ts

/**
 * Represents a successful outcome of an operation.
 * Contains the result value of type T and null for the error part.
 * @template T The type of the success value.
 */
export type Success<T> = [T, null]; // Exporting for potential direct use

/**
 * Represents a failed outcome of an operation.
 * Contains null for the result value and an error value of type E.
 * @template E The type of the error value.
 */
export type Failure<E> = [null, E]; // Exporting for potential direct use

/**
 * A discriminated union type representing the result of an operation that can either succeed or fail.
 * If the operation succeeds, it's a Success<T> tuple: [data, null].
 * If the operation fails, it's a Failure<E> tuple: [null, error].
 *
 * @template T The type of the success value.
 * @template E The type of the error value. Defaults to `unknown`.
 */
export type Result<T, E = unknown> = Success<T> | Failure<E>; // Exporting

/**
 * Wraps a synchronous function in a try-catch block and returns a Result tuple.
 * This utility function converts thrown errors into a predictable [null, error] tuple format.
 *
 * @template T The expected type of the data if the function executes successfully.
 * @template E The desired type of the error if the function throws. Defaults to `unknown`.
 *
 * @param {() => T} fn The synchronous function to wrap.
 * @param {(caughtError: unknown) => E} [mapError] An optional function to transform the caught error.
 * @returns {Result<T, E>} A Result tuple:
 *   - `[data, null]` if the function executes successfully.
 *   - `[null, error]` if the function throws an error.
 */
export function tryCatchSync<T, E = unknown>(
    fn: () => T,
    mapError?: (caughtError: unknown) => E
): Result<T, E> {
    try {
        const data = fn();
        return [data, null];
    } catch (error) {
        const finalError = mapError ? mapError(error) : (error as E);
        return [null, finalError];
    }
}

/**
 * Wraps a function that returns a Promise and returns a Promise that always resolves to a Result tuple.
 * This utility function prevents promise rejections from bubbling up, converting them
 * into a predictable [null, error] tuple format.
 *
 * @template T The expected type of the data if the promise resolves successfully.
 * @template E The desired type of the error if the promise rejects. Defaults to `unknown`.
 *
 * @param {() => Promise<T>} fn The function that returns a Promise to wrap.
 * @param {(caughtError: unknown) => E} [mapError] An optional function to transform the caught error.
 * @returns {Promise<Result<T, E>>} A Promise that resolves to:
 *   - `[data, null]` if the input promise resolves successfully.
 *   - `[null, error]` if the input promise rejects.
 */
export async function tryCatchAsync<T, E = unknown>(
    fn: () => Promise<T>,
    mapError?: (caughtError: unknown) => E
): Promise<Result<T, E>> {
    try {
        const data = await fn();
        return [data, null];
    } catch (error) {
        const finalError = mapError ? mapError(error) : (error as E);
        return [null, finalError];
    }
}