const { parseCoachPdfToJson } = require('./dist/lib/pdf-parser.js');

async function testParser() {
  try {
    const result = await parseCoachPdfToJson('./test.pdf', 'test-uuid', 1);
    console.log('Parsed result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error parsing PDF:', error);
  }
}

testParser();
