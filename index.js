const express = require('express');
const axios = require('axios');
const cql = require('cql-execution');
const cqlFhir = require('cql-exec-fhir'); // FHIR data source for cql-execution 3.x
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Helper to load compiled ELM JSON safely
function loadElmLibrary() {
  const elmPath = path.join(__dirname, 'elm', 'screening.json');
  if (!fs.existsSync(elmPath)) {
    throw new Error("Compiled ELM JSON not found. Please run 'npm run compile' first.");
  }
  const libJson = JSON.parse(fs.readFileSync(elmPath, 'utf8'));
  return new cql.Library(libJson);
}

// 1. Discovery Endpoint
app.get('/cds-services', (req, res) => {
  res.json({
    services: [
      {
        id: 'hypertension-screening',
        hook: 'patient-view',
        title: 'Adult Hypertension Screening Checker',
        description: 'Checks if an adult patient has a recent blood pressure reading recorded.',
        prefetch: {
          patientToEvaluate: 'Patient/{{context.patientId}}'
        }
      }
    ]
  });
});

// 2. Hook Evaluation Endpoint
app.post('/cds-services/hypertension-screening', async (req, res) => {
  try {
    const { hookInstance, fhirServer, fhirAuthorization, prefetch, context } = req.body;
    const patientId = context?.patientId;

    if (!patientId) {
      return res.status(400).json({ error: 'Missing target patientId in context.' });
    }

    // Use prefetch data if provided by EHR, otherwise fetch it manually from the HAPI FHIR server
    let patientResource = prefetch?.patientToEvaluate;
    if (!patientResource && fhirServer) {
      const response = await axios.get(`${fhirServer}/Patient/${patientId}`, {
        headers: fhirAuthorization ? { Authorization: `${fhirAuthorization.token_type} ${fhirAuthorization.access_token}` } : {}
      });
      patientResource = response.data;
    }

    // Fetch required runtime context observations (Blood Pressure readings) from HAPI FHIR
    let observations = [];
    if (fhirServer) {
      try {
        const obsResponse = await axios.get(`${fhirServer}/Observation?patient=${patientId}&code=8480-6&status=final`, {
          headers: fhirAuthorization ? { Authorization: `${fhirAuthorization.token_type} ${fhirAuthorization.access_token}` } : {}
        });
        if (obsResponse.data?.entry) {
          observations = obsResponse.data.entry.map(e => e.resource);
        }
      } catch (err) {
        console.error('Failed fetching runtime Observations from FHIR server:', err.message);
      }
    }

    // Package the raw FHIR records into a standard bundle for the execution library
    const fhirBundle = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [
        { resource: patientResource },
        ...observations.map(obs => ({ resource: obs }))
      ]
    };

    // Instantiate CQL engine environment
    const library = loadElmLibrary();
    const codeService = new cql.CodeService(); // Used if code systems/value sets are defined
    const executor = new cql.Executor(library, codeService);
    
    // Wrap patient bundle into the execution engine's data source wrapper
    const patientSource = cqlFhir.PatientSource.FHIRv401();
    patientSource.loadBundles([fhirBundle]);

    // Compute expressions
    const results = executor.exec(patientSource);
    const patientResults = results.patientResults[patientId];

    const needsScreening = patientResults['Needs Screening Alert'];

    // Generate CDS Hooks standard decision card array
    const responseCards = [];
    if (needsScreening === true) {
      responseCards.push({
        summary: 'Missing Adult Hypertension Screening',
        indicator: 'warning',
        detail: 'This adult patient does not have a recorded Blood Pressure reading in the database for the current measurement period. Please evaluate.',
        source: {
          label: 'Preventative Health Automated Rules Engine',
          url: 'https://example.org/guidelines'
        },
        links: fhirServer ? [
          {
            label: 'Record Vital Signs',
            url: `${fhirServer}/Observation`,
            type: 'absolute'
          }
        ] : []
      });
    }

    return res.json({ cards: responseCards });

  } catch (error) {
    console.error('CDS Execution Error:', error);
    return res.status(500).json({ error: 'Internal runtime clinical reasoning fault.', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`CDS Hooks Microservice running cleanly on port ${PORT}`);
});
