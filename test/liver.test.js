// Runs the compiled liver-screening ELM (elm/liver-screening.json) against fixture patients.
// Exits with code 1 if any rule result differs from the expectation.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const cql = require('cql-execution');
const cqlFhir = require('cql-exec-fhir');

const root = path.join(__dirname, '..');
const elmPath = path.join(root, 'elm', 'liver-screening.json');
if (!fs.existsSync(elmPath)) {
  console.error(`Missing ${elmPath}. Run "npm run compile" first.`);
  process.exit(1);
}

const library = new cql.Library(JSON.parse(fs.readFileSync(elmPath, 'utf8')));
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'liver.json'), 'utf8'));

let failures = 0;
for (const fx of fixtures) {
  const executor = new cql.Executor(library, new cql.CodeService());
  const source = cqlFhir.PatientSource.FHIRv401();
  const entries = [fx.patient, ...fx.observations].map(resource => ({ resource }));
  source.loadBundles([{ resourceType: 'Bundle', type: 'collection', entry: entries }]);

  const results = executor.exec(source);
  const actual = results.patientResults[fx.patient.id]['Needs Liver Screening Alert'];

  try {
    assert.strictEqual(actual, fx.expectAlert);
    console.log(`PASS  ${fx.name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL  ${fx.name}: expected ${fx.expectAlert}, got ${actual}`);
  }
}

if (failures > 0) {
  console.error(`${failures} of ${fixtures.length} liver tests failed.`);
  process.exit(1);
}
console.log(`All ${fixtures.length} liver tests passed.`);
