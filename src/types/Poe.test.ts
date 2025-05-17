// src/types/Poe.test.ts

import {PoeEmbedAPIError, type PoeEmbedAPIErrorType} from './Poe';

// This test suite is mostly for code coverage so we don't have to add ignore comments to the Poe.ts file.

describe('PoeEmbedAPIError', () => {
    it('should be an instance of Error', () => {
        const errorMessage = "Test Poe API Error";
        const err = new PoeEmbedAPIError(errorMessage);
        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(PoeEmbedAPIError);
    });

    it('should have a message property', () => {
        const errorMessage = "Another Test Error";
        const err = new PoeEmbedAPIError(errorMessage);
        expect(err.message).toBe(errorMessage);
    });

    it('should have an errorType property (even if undefined by default when manually instantiated)', () => {
        const errorMessage = "Error with type check";
        const err = new PoeEmbedAPIError(errorMessage);

        expect('errorType' in err).toBe(true);

        const errorTypeProperty = err.errorType;
        expect(errorTypeProperty).toBeUndefined();

        const mockErrorType: PoeEmbedAPIErrorType = "INVALID_INPUT";
        (err as any).errorType = mockErrorType; // Cast to any or directly assign if TS allows
        expect(err.errorType).toBe(mockErrorType);
    });

    it('should have a name property typically set to "Error" by default, or class name', () => {
        const err = new PoeEmbedAPIError("Test");
        expect(typeof err.name).toBe('string');
        expect(err.name.length).toBeGreaterThan(0);
    });
});