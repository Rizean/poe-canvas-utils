// src/utils/storage.test.ts
import {loadDataFromFile, LoadOptions, saveDataToFile, VersionedData} from './storage';

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
let mockFileInputChangeCallback: ((event: Partial<Event>) => Promise<void> | void) | null = null; // Can be async
let mockFileInputClick: jest.Mock;

// Redefine mockFileReaderInstance structure slightly for clarity
let mockFileReader: {
    readAsText: jest.Mock;
    result: string | ArrayBuffer | null;
    onload: ((ev: Partial<ProgressEvent<FileReader>>) => void) | null; // Make event partial
    onerror: ((ev: Partial<ProgressEvent<FileReader>>) => void) | null; // Make event partial
    _triggerOnload: (content: string | ArrayBuffer | null) => void;
    _triggerOnerror: () => void;
};


// Helper to simulate file selection
async function simulateFileSelection(fileContent: string | object | null, fileName = 'test.json') {
    let contentString: string | undefined;
    if (fileContent === null) {
        contentString = undefined;
    } else if (typeof fileContent === 'string') {
        contentString = fileContent;
    } else {
        contentString = JSON.stringify(fileContent);
    }

    const file = contentString !== undefined ? new File([contentString], fileName, {type: 'application/json'}) : null;

    // The FileReader's readAsText will be called. We then simulate its async completion.
    // The actual triggering of onload/onerror will happen from the test.
    mockFileReader.readAsText.mockImplementationOnce((_f: File) => {
        // Simulate that readAsText has been called, but don't immediately trigger onload/onerror.
        // The test will do that to control the async flow.
        mockFileReader.result = contentString || ''; // Store for when onload is triggered
    });

    const mockEvent: Partial<Event> = {
        target: {
            files: file ? [file] : null,
        } as unknown as HTMLInputElement,
    };

    if (mockFileInputChangeCallback) {
        // The onchange handler itself in storage.ts is async.
        // We need to await its completion if it returns a promise,
        // though in its current form it doesn't explicitly return one from the onchange assignment.
        // The promise we care about is the one from loadDataFromFile.
        await Promise.resolve(mockFileInputChangeCallback(mockEvent));
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
                    style: {display: ''},
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
        if (typeof global.URL.createObjectURL === 'undefined') {
            global.URL.createObjectURL = mockCreateObjectURL;
            global.URL.revokeObjectURL = mockRevokeObjectURL;
        } else {
            jest.spyOn(global.URL, 'createObjectURL').mockImplementation(mockCreateObjectURL);
            jest.spyOn(global.URL, 'revokeObjectURL').mockImplementation(mockRevokeObjectURL);
        }

        mockFileReader = {
            readAsText: jest.fn(),
            result: null,
            onload: null,
            onerror: null,
            _triggerOnload: (content) => {
                mockFileReader.result = content;
                if (mockFileReader.onload) {
                    mockFileReader.onload({target: {result: mockFileReader.result}} as Partial<ProgressEvent<FileReader>>);
                }
            },
            _triggerOnerror: () => {
                if (mockFileReader.onerror) {
                    mockFileReader.onerror({} as Partial<ProgressEvent<FileReader>>);
                }
            },
        };
        jest.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as unknown as FileReader);

        mockFileInputChangeCallback = null;
    });

    // ... saveDataToFile tests remain the same ...
    describe('saveDataToFile', () => {
        it('should trigger download for valid data', () => {
            const data: MyTestDataV1 = {version: 1, name: 'Test User'};
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
            const data = {name: 'No Version'} as any;
            const [success, error] = saveDataToFile('no-version.json', data);

            expect(success).toBeNull();
            expect(error).toBeInstanceOf(Error);
            expect(error?.message).toBe("Data must have a 'version' property of type number.");
            expect(mockAnchorClick).not.toHaveBeenCalled();
        });

        it('should return an error if JSON.stringify fails', () => {
            const circularData: any = {version: 1, name: 'Circular'};
            circularData.self = circularData;
            const [success, error] = saveDataToFile('circular.json', circularData);

            expect(success).toBeNull();
            expect(error).toBeInstanceOf(Error);
            expect(error?.message).toContain('circular structure');
            expect(mockAnchorClick).not.toHaveBeenCalled();
        });
    });


    describe('loadDataFromFile', () => {
        it('should load and parse valid JSON file with matching version', async () => {
            const fileData: MyTestDataV1 = {version: 1, name: 'Loaded User'};
            const options: LoadOptions<MyTestDataV1> = {currentVersion: 1};

            const loadPromise = loadDataFromFile<MyTestDataV1>(options);
            expect(mockFileInputClick).toHaveBeenCalledTimes(1); // Input is clicked

            // Simulate file selection by user and then FileReader completing
            await simulateFileSelection(fileData); // This sets up the FileReader mock
            mockFileReader._triggerOnload(JSON.stringify(fileData)); // Manually trigger onload

            const [data, error] = await loadPromise;

            expect(error).toBeNull();
            expect(data).toEqual(fileData);
        });

        it('should return [null, null] if user cancels file dialog (no file selected)', async () => {
            const options: LoadOptions<MyTestDataV1> = {currentVersion: 1};
            const loadPromise = loadDataFromFile<MyTestDataV1>(options);
            expect(mockFileInputClick).toHaveBeenCalledTimes(1);

            // Simulate no file being selected (which triggers onchange with files=null)
            await simulateFileSelection(null);
            // No need to trigger onload/onerror as the `!files` check handles this

            const [data, error] = await loadPromise;
            expect(data).toBeNull();
            expect(error).toBeNull();
        });


        it('should return error if file content is not valid JSON', async () => {
            const options: LoadOptions<MyTestDataV1> = {currentVersion: 1};
            const loadPromise = loadDataFromFile<MyTestDataV1>(options);
            await simulateFileSelection("not json");
            mockFileReader._triggerOnload("not json");


            const [data, error] = await loadPromise;
            expect(data).toBeNull();
            expect(error).toBeInstanceOf(Error);
            expect(error?.message).toContain('Failed to parse JSON from file');
        });

        it('should cover if fileContent is not a string (e.g. ArrayBuffer)', async () => {
            const options: LoadOptions<MyTestDataV1> = {currentVersion: 1};
            const loadPromise = loadDataFromFile<MyTestDataV1>(options);
            await simulateFileSelection("valid json but will be overridden"); // File selected
            mockFileReader._triggerOnload(new ArrayBuffer(8)); // FileReader returns ArrayBuffer

            const [data, error] = await loadPromise;
            expect(data).toBeNull();
            expect(error).toBeInstanceOf(Error);
            expect(error?.message).toBe("Failed to read file content as text.");
        });

        it('should return error if parsed data is not an object', async () => {
            const options: LoadOptions<MyTestDataV1> = {currentVersion: 1};
            const loadPromise = loadDataFromFile<MyTestDataV1>(options);
            await simulateFileSelection("123"); // Content is a valid JSON number
            mockFileReader._triggerOnload("123");

            const [data, error] = await loadPromise;
            expect(data).toBeNull();
            expect(error?.message).toBe("Invalid data format: Loaded file must contain an object with a 'version' property of type number.");
        });


        it('should return error if parsed data has no version property', async () => {
            const fileContent = {name: 'No Version Prop'};
            const options: LoadOptions<MyTestDataV1> = {currentVersion: 1};
            const loadPromise = loadDataFromFile<MyTestDataV1>(options);
            await simulateFileSelection(fileContent);
            mockFileReader._triggerOnload(JSON.stringify(fileContent));


            const [data, error] = await loadPromise;
            expect(data).toBeNull();
            expect(error?.message).toBe("Invalid data format: Loaded file must contain an object with a 'version' property of type number.");
        });

        it('should return error if parsed data version is not a number', async () => {
            const fileContent = {version: '1', name: 'String version'};
            const options: LoadOptions<MyTestDataV1> = {currentVersion: 1};
            const loadPromise = loadDataFromFile<MyTestDataV1>(options);
            await simulateFileSelection(fileContent);
            mockFileReader._triggerOnload(JSON.stringify(fileContent));

            const [data, error] = await loadPromise;
            expect(data).toBeNull();
            expect(error?.message).toBe("Invalid data format: Loaded file must contain an object with a 'version' property of type number.");
        });


        it('should migrate data if loaded version is older', async () => {
            const oldData: MyTestDataV1 = {version: 1, name: 'Old User for File'};
            const migrateFn = jest.fn((loadedData: any): MyTestDataV2 => {
                return {version: 2, fullName: (loadedData as MyTestDataV1).name, age: 33};
            });
            const options: LoadOptions<MyTestDataV2> = {currentVersion: 2, migrate: migrateFn};

            const loadPromise = loadDataFromFile<MyTestDataV2>(options);
            await simulateFileSelection(oldData);
            mockFileReader._triggerOnload(JSON.stringify(oldData));


            const [data, error] = await loadPromise;

            expect(error).toBeNull();
            expect(migrateFn).toHaveBeenCalledWith(oldData, 1);
            expect(data).toEqual({version: 2, fullName: 'Old User for File', age: 33});
        });

        it('should return error if migration is needed but no migrate function provided', async () => {
            const oldData: MyTestDataV1 = {version: 1, name: 'Needs Migration'};
            const options: LoadOptions<MyTestDataV2> = {currentVersion: 2 /* no migrate */};
            const loadPromise = loadDataFromFile<MyTestDataV2>(options);
            await simulateFileSelection(oldData);
            mockFileReader._triggerOnload(JSON.stringify(oldData));

            const [data, error] = await loadPromise;
            expect(data).toBeNull();
            expect(error?.message).toBe(`Data version ${oldData.version} is older than current version 2, and no migration function was provided.`);
        });

        it('should return error if migration function fails to update to currentVersion', async () => {
            const oldData: MyTestDataV1 = {version: 1, name: 'Bad Migration'};
            const migrateFn = jest.fn((): MyTestDataV1 => ({version: 1, name: 'Still Old'})); // Wrong version
            // @ts-expect-error we expect - TS2322: Type Mock<MyTestDataV1, [], any> is not assignable to type MyTestDataV2 | Promise<MyTestDataV2> as this is a bad load
            const options: LoadOptions<MyTestDataV2> = {currentVersion: 2, migrate: migrateFn};
            const loadPromise = loadDataFromFile<MyTestDataV2>(options);
            await simulateFileSelection(oldData);
            mockFileReader._triggerOnload(JSON.stringify(oldData));

            const [data, error] = await loadPromise;
            expect(data).toBeNull();
            expect(error?.message).toBe("Migration function failed to update data to the current version or version property is invalid.");
        });


        it('should return error if migration function throws', async () => {
            const oldData: MyTestDataV1 = {version: 1, name: 'Error Migration'};
            const migrateFn = jest.fn(() => {
                throw new Error("Kaboom migration");
            });
            const options: LoadOptions<MyTestDataV2> = {currentVersion: 2, migrate: migrateFn};
            const loadPromise = loadDataFromFile<MyTestDataV2>(options);
            await simulateFileSelection(oldData);
            mockFileReader._triggerOnload(JSON.stringify(oldData));

            const [data, error] = await loadPromise;
            expect(data).toBeNull();
            expect(error?.message).toBe("Data migration failed: Kaboom migration");
        });


        it('should return error if loaded data version is newer', async () => {
            const newerData: MyTestDataV2 = {version: 2, fullName: 'Future File User'};
            const options: LoadOptions<MyTestDataV1> = {currentVersion: 1};
            const loadPromise = loadDataFromFile<MyTestDataV1>(options);
            await simulateFileSelection(newerData);
            mockFileReader._triggerOnload(JSON.stringify(newerData));


            const [data, error] = await loadPromise;
            expect(data).toBeNull();
            expect(error?.message).toBe('Loaded data version 2 is newer than current version 1. This is not supported.');
        });

        it('should validate data after loading (and migration if any)', async () => {
            const fileData: MyTestDataV1 = {version: 1, name: 'Validate Me'};
            const validateFn = jest.fn((d: MyTestDataV1) => d.name === 'Validate Me');
            const options: LoadOptions<MyTestDataV1> = {currentVersion: 1, validate: validateFn};

            const loadPromise = loadDataFromFile<MyTestDataV1>(options);
            await simulateFileSelection(fileData);
            mockFileReader._triggerOnload(JSON.stringify(fileData));


            const [data, error] = await loadPromise;

            expect(error).toBeNull();
            expect(validateFn).toHaveBeenCalledWith(fileData);
            expect(data).toEqual(fileData);
        });

        it('should return error if validation fails', async () => {
            const fileData: MyTestDataV1 = {version: 1, name: 'Will Fail Validation'};
            const validateFn = jest.fn(() => false);
            const options: LoadOptions<MyTestDataV1> = {currentVersion: 1, validate: validateFn};

            const loadPromise = loadDataFromFile<MyTestDataV1>(options);
            await simulateFileSelection(fileData);
            mockFileReader._triggerOnload(JSON.stringify(fileData));


            const [data, error] = await loadPromise;
            expect(data).toBeNull();
            expect(error?.message).toBe('Loaded data failed validation.');
        });

        it('should return error if validation function throws', async () => {
            const fileData: MyTestDataV1 = {version: 1, name: 'Validate Me Error'};
            const validateFn = jest.fn(() => {
                throw new Error("Kaboom validation");
            });
            const options: LoadOptions<MyTestDataV1> = {currentVersion: 1, validate: validateFn};
            const loadPromise = loadDataFromFile<MyTestDataV1>(options);
            await simulateFileSelection(fileData);
            mockFileReader._triggerOnload(JSON.stringify(fileData));

            const [data, error] = await loadPromise;
            expect(data).toBeNull();
            expect(error?.message).toBe("Data validation failed: Kaboom validation");
        });


        it('should handle FileReader errors', async () => {
            const options: LoadOptions<MyTestDataV1> = {currentVersion: 1};
            const loadPromise = loadDataFromFile<MyTestDataV1>(options);

            await simulateFileSelection("any content to trigger read");
            mockFileReader._triggerOnerror(); // Manually trigger onerror

            const [data, error] = await loadPromise;
            expect(data).toBeNull();
            expect(error).toBeInstanceOf(Error);
            expect(error?.message).toBe('Error reading file.');
        });
    });
});