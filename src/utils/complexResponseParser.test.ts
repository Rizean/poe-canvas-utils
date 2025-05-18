// src/utils/complexResponseParser.test.ts
import { complexResponseParser } from './complexResponseParser'; // Adjust path

describe('complexResponseParser', () => {
    it('should parse response with default tags and JSON data', () => {
        const text = `
Some preamble.
*Thinking...*
> This is a thought.
<response>
This is the main response content.
</response>
Some text after response.
\`\`\`json
{
  "key": "value",
  "number": 123
}
\`\`\`
Some trailing text.`;
        const [result, error] = complexResponseParser(text);

        expect(error).toBeNull();
        expect(result).toEqual({
            response: "This is the main response content.",
            data: { key: "value", number: 123 },
        });
    });

    it('should parse response with custom tags and JSON data', () => {
        const text = `
[START_R]
Custom response here.
[END_R]
\`\`\`json
{"custom": true}
\`\`\`
`;
        const options = { responseStartTag: "[START_R]", responseEndTag: "[END_R]" };
        const [result, error] = complexResponseParser(text, options);

        expect(error).toBeNull();
        expect(result).toEqual({
            response: "Custom response here.",
            data: { custom: true },
        });
    });

    it('should handle incomplete response block (start tag present, end tag missing)', () => {
        const text = `
<response>
This is an incomplete response...
Still going.
\`\`\`json
{"partial": "data"}
\`\`\`
`; // JSON block might be present but ideally shouldn't be parsed if response is incomplete
        const [result, error] = complexResponseParser(text);

        expect(error).toBeNull();
        expect(result).toEqual({
            response: "This is an incomplete response...\nStill going.\n\`\`\`json\n{\"partial\": \"data\"}\n\`\`\`",
            // data field should be absent because textAfterResponseBlock was set to ""
        });
    });

    it('should handle incomplete response block with custom tags', () => {
        const text = `[BEGIN]This is partial.`;
        const options = { responseStartTag: "[BEGIN]", responseEndTag: "[FINISH]" };
        const [result, error] = complexResponseParser(text, options);

        expect(error).toBeNull();
        expect(result).toEqual({
            response: "This is partial.",
        });
    });


    it('should parse response correctly when no JSON block is present', () => {
        const text = `
<response>
Just a response, no data.
</response>
`;
        const [result, error] = complexResponseParser(text);

        expect(error).toBeNull();
        expect(result).toEqual({
            response: "Just a response, no data.",
            // No 'data' key
        });
    });

    it('should return an error if JSON block is present but malformed', () => {
        const text = `
<response>
Response is fine.
</response>
\`\`\`json
{
  "key": "value",
  "malformed: 123
}
\`\`\`
`;
        const [result, error] = complexResponseParser(text);

        expect(result).toBeNull();
        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toMatch(/JSON/i); // Or a more specific message if JSON.parse provides one
    });

    it('should handle text with no response tags and no JSON', () => {
        const text = "Just some plain text without any special tags or JSON.";
        const [result, error] = complexResponseParser(text);

        expect(error).toBeNull();
        expect(result).toEqual({
            response: "", // No response block found
            // No 'data' key
        });
    });

    it('should handle text with no response tags but with a JSON block', () => {
        const text = `
No response tags here.
\`\`\`json
{"orphan": "json"}
\`\`\`
`;
        const [result, error] = complexResponseParser(text);

        expect(error).toBeNull();
        expect(result).toEqual({
            response: "",
            data: { orphan: "json" },
        });
    });

    it('should handle empty input string', () => {
        const text = "";
        const [result, error] = complexResponseParser(text);
        expect(error).toBeNull();
        expect(result).toEqual({ response: "" });
    });

    it('should trim whitespace from the extracted response content', () => {
        const text = `
<response>
  Indented response with spaces.  
</response>
`;
        const [result, error] = complexResponseParser(text);
        expect(error).toBeNull();
        expect(result?.response).toBe("Indented response with spaces.");
    });

    it('should correctly parse JSON even if response block is empty', () => {
        const text = `
<response></response>
\`\`\`json
{"dataOnly": true}
\`\`\`
`;
        const [result, error] = complexResponseParser(text);
        expect(error).toBeNull();
        expect(result).toEqual({
            response: "",
            data: { dataOnly: true },
        });
    });

    it('should correctly parse JSON if response block is absent but custom tags were specified', () => {
        const text = `
Some other content.
\`\`\`json
{"dataOnlyCustom": true}
\`\`\`
`;
        const options = { responseStartTag: "[START]", responseEndTag: "[END]" };
        const [result, error] = complexResponseParser(text, options);
        expect(error).toBeNull();
        expect(result).toEqual({
            response: "",
            data: { dataOnlyCustom: true },
        });
    });

    it('should correctly handle text after response block but before JSON', () => {
        const text = `
<response>
Main response.
</response>
This is intermediate text.
It should not be in the response.
Nor should it break JSON parsing.
\`\`\`json
{"key": "value"}
\`\`\`
`;
        const [result, error] = complexResponseParser(text);
        expect(error).toBeNull();
        expect(result).toEqual({
            response: "Main response.",
            data: {key: "value"}
        });
    });
});