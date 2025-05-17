// src/utils/storage.test.ts

import { saveDataToFile, loadDataFromFile, VersionedData, LoadOptions } from './storage';

interface MyTestDataV1 extends VersionedData {
    version: 1;
    name: string;
}

interface MyTestDataV2 extends VersionedData {
    version: 2;
    fullName: string;
    age?: number;
}

// --- Mocks ---
let mockAnchorClick: jest.Mock;
let mockCreateObjectURL: jest.Mock;
let mockRevokeObjectURL: jest.Mock;
let mockFileInputChangeCallback: ((event: Partial<Event>) => void) | null = null;
let mockFileInputClick: jest.Mock;
let mockFileReaderInstance: {
    readAsText: jest.Mock;
    result: string | ArrayBuffer | null;
    onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null;
    onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null;
};


// Helper to simulate file selection
function simulateFileSelection(fileContent: string | object | null, fileName = 'test.json') {
    let contentString: string | undefined;
    if (fileContent === null) {
        contentString = undefined; // Explicitly undefined for no file
    } else if (typeof fileContent === 'string') {
        contentString = fileContent;
    } else {
        contentString = JSON.stringify(fileContent);
    }

    const file = contentString !== undefined ? new File([contentString], fileName, { type: 'application/json' }) : null;

    // Make the mock FileReader use this content when its readAsText is called
    if (mockFileReaderInstance) {
        mockFileReaderInstance.readAsText.mockImplementationOnce(function(this: any, _f: File) {
            // Store the content on the reader instance itself for onload to use
            // This more closely mimics how FileReader works.
            mockFileReaderInstance.result = contentString || ''; // Use empty string if contentString is undefined
            if (this.onload) {
                // Ensure 'this' inside onload refers to the mockFileReaderInstance
                this.onload({ target: mockFileReaderInstance } as unknown as ProgressEvent<FileReader>);
            }
        });
    }


    const mockEvent: Partial<Event> = {
        target: {
            files: file ? [file] : null,
        } as unknown as HTMLInputElement,
    };

    if (mockFileInputChangeCallback) {
        mockFileInputChangeCallback(mockEvent);
    }
}


describe('Storage Utility (File Based)', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockAnchorClick = jest.fn();
        const mockAnchor = {
            href: '',
            download: '',
            click: mockAnchorClick,
        } as unknown as HTMLAnchorElement;
        jest.spyOn(document, 'createElement').mockImplementation((tagName: string): HTMLElement => {
            if (tagName === 'a') {
                return mockAnchor;
            }
            if (tagName === 'input') {
                mockFileInputClick = jest.fn();
                return {
                    type: '',
                    accept: '',
                    style: { display: '' },
                    click: mockFileInputClick,
                    set onchange(callback: any) {
                        mockFileInputChangeCallback = callback;
                    },
                    get onchange() {
                        return mockFileInputChangeCallback as any;
                    }
                } as unknown as HTMLInputElement;
            }
            return {} as HTMLElement;
        });
        jest.spyOn(document.body, 'appendChild').mockImplementation();
        jest.spyOn(document.body, 'removeChild').mockImplementation();

        mockCreateObjectURL = jest.fn((blob: Blob) => `blob:${blob.type}/${blob.size}`);
        mockRevokeObjectURL = jest.fn();
        if (typeof global.URL.createObjectURL === 'undefined') { // JSDOM might not have it
            global.URL.createObjectURL = mockCreateObjectURL;
            global.URL.revokeObjectURL = mockRevokeObjectURL;
        } else {
            jest.spyOn(global.URL, 'createObjectURL').mockImplementation(mockCreateObjectURL);
            jest.spyOn(global.URL, 'revokeObjectURL').mockImplementation(mockRevokeObjectURL);
        }


        mockFileReaderInstance = {
            readAsText: jest.fn(),
            result: null, // Initialize result
            onload: null,
            onerror: null,
        };
        jest.spyOn(global, 'FileReader').mockImplementation(() => mockFileReaderInstance as unknown as FileReader);

        mockFileInputChangeCallback = null;
    });

    describe('saveDataToFile', () => {
        it('should trigger download for valid data', () => {
            const data: MyTestDataV1 = { version: 1, name: 'Test User' };
            const filename = 'user-data.json';
            const [success, error] = saveDataToFile(filename, data);

            expect(success).toBe(true);
            expect(error).toBeNull();
            expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
            expect(document.createElement).toHaveBeenCalledWith('a');
            const anchor = (document.createElement as jest.Mock).mock.results[0].value;
            expect(anchor.download).toBe(filename);
            expect(anchor.href).toMatch(/^blob:/);
            expect(mockAnchorClick).toHaveBeenCalledTimes(1);
            expect(document.body.appendChild).toHaveBeenCalled();
            expect(document.body.removeChild).toHaveBeenCalled();
            expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1);
        });

        it('should return an error if data has no version property', () => {
            const data = { name: 'No Version' } as any;
            const [success, error] = saveDataToFile('no-version.json', data);

            expect(success).toBeNull();
            expect(error).toBeInstanceOf(Error);
            expect(error?.message).toBe("Data must have a 'version' property of type number.");
            expect(mockAnchorClick).not.toHaveBeenCalled();
        });

        it('should return an error if JSON.stringify fails', () => {
            const circularData: any = { version: 1, name: 'Circular' };
            circularData.self = circularData;
            const [success, error] = saveDataToFile('circular.json', circularData);

            expect(success).toBeNull();
            expect(error).toBeInstanceOf(Error);
            expect(error?.message).toContain('circular structure'); // Or specific message from your env
            expect(mockAnchorClick).not.toHaveBeenCalled();
        });
    });

    describe('loadDataFromFile', () => {
        it('should load and parse valid JSON file with matching version', async () => {
            const fileData: MyTestDataV1 = { version: 1, name: 'Loaded User' };
            const options: LoadOptions<MyTestDataV1> = { currentVersion: 1 };

            const loadPromise = loadDataFromFile<MyTestDataV1>(options);
            expect(mockFileInputClick).toHaveBeenCalledTimes(1);

            simulateFileSelection(fileData);

            const [data, error] = await loadPromise;

            expect(error).toBeNull();
            expect(data).toEqual(fileData);
        });

        it('should return [null, null] if user cancels file dialog (no file selected)', async () => {
            const options: LoadOptions<MyTestDataV1> = { currentVersion: 1 };
            const loadPromise = loadDataFromFile<MyTestDataV1>(options);
            expect(mockFileInputClick).toHaveBeenCalledTimes(1);

            simulateFileSelection(null); // No file / user cancelled

            const [data, error] = await loadPromise;
            expect(data).toBeNull();
            expect(error).toBeNull();
        });


        it('should return error if file content is not valid JSON', async () => {
            const options: LoadOptions<MyTestDataV1> = { currentVersion: 1 };
            const loadPromise = loadDataFromFile<MyTestDataV1>(options);
            simulateFileSelection("not json");


            const [data, error] = await loadPromise;
            expect(data).toBeNull();
            expect(error).toBeInstanceOf(Error);
            expect(error?.message).toContain('Failed to parse JSON from file');
        });

        it('should return error if parsed data has no version property', async () => {
            const fileContent = { name: 'No Version Prop' };
            const options: LoadOptions<MyTestDataV1> = { currentVersion: 1 };
            const loadPromise = loadDataFromFile<MyTestDataV1>(options);
            simulateFileSelection(fileContent);

            const [data, error] = await loadPromise;
            expect(data).toBeNull();
            expect(error?.message).toBe("Invalid data format: Loaded file must contain an object with a 'version' property of type number.");
        });


        it('should migrate data if loaded version is older', async () => {
            const oldData: MyTestDataV1 = { version: 1, name: 'Old User for File' };
            const migrateFn = jest.fn((loadedData: any): MyTestDataV2 => {
                return { version: 2, fullName: (loadedData as MyTestDataV1).name, age: 33 };
            });
            const options: LoadOptions<MyTestDataV2> = { currentVersion: 2, migrate: migrateFn };

            const loadPromise = loadDataFromFile<MyTestDataV2>(options);
            simulateFileSelection(oldData);

            const [data, error] = await loadPromise;

            expect(error).toBeNull();
            expect(migrateFn).toHaveBeenCalledWith(oldData, 1);
            expect(data).toEqual({ version: 2, fullName: 'Old User for File', age: 33 });
        });

        it('should return error if loaded data version is newer', async () => {
            const newerData: MyTestDataV2 = { version: 2, fullName: 'Future File User' };
            const options: LoadOptions<MyTestDataV1> = { currentVersion: 1 };
            const loadPromise = loadDataFromFile<MyTestDataV1>(options);
            simulateFileSelection(newerData);

            const [data, error] = await loadPromise;
            expect(data).toBeNull();
            expect(error?.message).toBe('Loaded data version 2 is newer than current version 1. This is not supported.');
        });

        it('should validate data after loading (and migration if any)', async () => {
            const fileData: MyTestDataV1 = { version: 1, name: 'Validate Me' };
            const validateFn = jest.fn((d: MyTestDataV1) => d.name === 'Validate Me');
            const options: LoadOptions<MyTestDataV1> = { currentVersion: 1, validate: validateFn };

            const loadPromise = loadDataFromFile<MyTestDataV1>(options);
            simulateFileSelection(fileData);

            const [data, error] = await loadPromise;

            expect(error).toBeNull();
            expect(validateFn).toHaveBeenCalledWith(fileData);
            expect(data).toEqual(fileData);
        });

        it('should return error if validation fails', async () => {
            const fileData: MyTestDataV1 = { version: 1, name: 'Will Fail Validation' };
            const validateFn = jest.fn(() => false);
            const options: LoadOptions<MyTestDataV1> = { currentVersion: 1, validate: validateFn };

            const loadPromise = loadDataFromFile<MyTestDataV1>(options);
            simulateFileSelection(fileData);

            const [data, error] = await loadPromise;
            expect(data).toBeNull();
            expect(error?.message).toBe('Loaded data failed validation.');
        });

        it('should handle FileReader errors', async () => {
            const options: LoadOptions<MyTestDataV1> = { currentVersion: 1 };
            const loadPromise = loadDataFromFile<MyTestDataV1>(options);

            // Configure the mock FileReader to call onerror
            mockFileReaderInstance.readAsText.mockImplementationOnce(function(this: any) {
                if (this.onerror) {
                    // Ensure 'this' inside onerror refers to the mockFileReaderInstance
                    this.onerror({ target: mockFileReaderInstance } as unknown as ProgressEvent<FileReader>);
                }
            });

            // Simulate file selection (content doesn't matter as much as triggering the flow)
            simulateFileSelection("any content to trigger read");


            const [data, error] = await loadPromise;
            expect(data).toBeNull();
            expect(error).toBeInstanceOf(Error);
            expect(error?.message).toBe('Error reading file.');
        });
    });
});