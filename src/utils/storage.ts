// src/utils/storage.ts
import {Result} from './tryCatch';

/**
 * Interface for data that can be saved and loaded.
 * Must include a version number.
 */
export interface VersionedData {
    version: number;

    [key: string]: any; // Allows any other properties
}

/**
 * Options for loading data.
 */
export interface LoadOptions<T extends VersionedData> {
    /**
     * The current version of the application's data structure.
     * If the loaded data's version is older, the migration function will be called.
     */
    currentVersion: number;
    /**
     * A function to migrate data from an older version to a newer version.
     * It receives the loaded data and the version it was saved with.
     * It should return the migrated data, conforming to the latest structure,
     * or throw an error if migration is not possible.
     * If not provided, data from older versions will be rejected if their version
     * does not match `currentVersion`.
     */
    migrate?: (loadedData: any, loadedVersion: number) => T | Promise<T>;
    /**
     * An optional function to validate the data after loading and potential migration.
     * It receives the data (expected to be of type T) and should return true if valid,
     * false otherwise. If it returns false or throws, loading will fail.
     */
    validate?: (data: T) => boolean | Promise<boolean>;
}

/**
 * Triggers a browser download for the given data as a JSON file.
 * The data must be JSON serializable and include a `version` property.
 *
 * @param filename The default filename for the downloaded file (e.g., "my-data.json").
 * @param data The data to save. Must be an object with a `version` property.
 * @returns A Result tuple: `[true, null]` on success, `[null, Error]` on failure (e.g., data not serializable).
 */
export function saveDataToFile<T extends VersionedData>(filename: string, data: T): Result<true, Error> {
    if (typeof data.version !== 'number') {
        return [null, new Error("Data must have a 'version' property of type number.")];
    }

    let serializedData: string;
    try {
        serializedData = JSON.stringify(data, null, 2); // Pretty print JSON
    } catch (e) {
        return [null, e instanceof Error ? e /* v8 ignore next */ : new Error(String(e))];
    }

    try {
        const blob = new Blob([serializedData], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a); // Required for Firefox
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return [true, null];
    } /* v8 ignore next 3 */ catch (e) {
        // For errors during DOM manipulation or URL creation, less common than serialization errors.
        return [null, e instanceof Error ? e : new Error(`Failed to initiate download: ${String(e)}`)];
    }
}

/**
 * Prompts the user to select a JSON file for loading, then processes it.
 *
 * @param options Options for loading, including current version and migration/validation logic.
 * @returns A Promise resolving to a Result tuple: `[T | null, Error | null]`.
 *          - `[T, null]` if data is loaded, (migrated if necessary), and validated successfully.
 *          - `[null, null]` if the user cancels the file dialog or selects no file.
 *          - `[null, Error]` if any error occurs during file reading, parsing, migration, or validation.
 */
export function loadDataFromFile<T extends VersionedData>(
    options: LoadOptions<T>
): Promise<Result<T | null, Error | null>> {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';

        input.onchange = async (event) => {
            const files = (event.target as HTMLInputElement).files;
            if (!files || files.length === 0) {
                resolve([null, null]); // User cancelled or no file selected
                return;
            }
            const file = files[0];
            const reader = new FileReader();

            reader.onload = async (e) => {
                const fileContent = e.target?.result;
                if (typeof fileContent !== 'string') {
                    resolve([null, new Error("Failed to read file content as text.")]);
                    return;
                }

                let parsedData: any;
                try {
                    parsedData = JSON.parse(fileContent);
                } catch (err) {
                    resolve([null, new Error(`Failed to parse JSON from file: ${(err as Error).message}`)]);
                    return;
                }

                if (typeof parsedData !== 'object' || parsedData === null || typeof parsedData.version !== 'number') {
                    resolve([null, new Error("Invalid data format: Loaded file must contain an object with a 'version' property of type number.")]);
                    return;
                }

                const {currentVersion, migrate, validate} = options;
                let dataToValidate: T;

                if (parsedData.version < currentVersion) {
                    if (!migrate) {
                        resolve([null, new Error(`Data version ${parsedData.version} is older than current version ${currentVersion}, and no migration function was provided.`)]);
                        return;
                    }
                    try {
                        const migratedData = await migrate(parsedData, parsedData.version);
                        if (typeof migratedData.version !== 'number' || migratedData.version !== currentVersion) {
                            resolve([null, new Error("Migration function failed to update data to the current version or version property is invalid.")]);
                            return;
                        }
                        dataToValidate = migratedData;
                    } catch (err) {
                        resolve([null, new Error(`Data migration failed: ${(err as Error).message}`)]);
                        return;
                    }
                } else if (parsedData.version > currentVersion) {
                    resolve([null, new Error(`Loaded data version ${parsedData.version} is newer than current version ${currentVersion}. This is not supported.`)]);
                    return;
                } else {
                    dataToValidate = parsedData as T;
                }

                if (validate) {
                    try {
                        const isValid = await validate(dataToValidate);
                        if (!isValid) {
                            resolve([null, new Error("Loaded data failed validation.")]);
                            return;
                        }
                    } catch (err) {
                        resolve([null, new Error(`Data validation failed: ${(err as Error).message}`)]);
                        return;
                    }
                }
                resolve([dataToValidate, null]);
            };

            reader.onerror = () => {
                resolve([null, new Error("Error reading file.")]);
            };

            reader.readAsText(file);
        };

        // Clean up the input element in case it's not used or the promise is handled elsewhere
        // This is a bit tricky as the input is clicked and then the user interacts.
        // A more robust cleanup might involve removing it after the 'change' or if the promise is GC'd.
        // For simplicity here, we don't add it to the DOM unless strictly necessary (like Firefox for 'a' tags).
        // input.style.display = 'none'; // Hide it
        // document.body.appendChild(input); // Not always needed for click()

        input.click();

        // If the input is not added to the body, it might be garbage collected if the user takes too long.
        // However, adding and removing it can be complex if the user cancels.
        // The `onchange` will fire if a file is selected. If not, the promise remains pending
        // until a timeout or explicit cancellation mechanism is added (which is beyond current scope).
        // A common pattern is to resolve with [null, null] on a window focus event if no file was selected,
        // indicating a probable cancellation, but that's more involved.
    });
}