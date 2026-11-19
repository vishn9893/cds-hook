#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p tools/lib cql

echo "Resolving HL7 CQL-to-ELM CLI and dependencies (Maven)..."
# Requires Maven on PATH. On corporate networks with TLS inspection, set
#   MAVEN_OPTS=-Djavax.net.ssl.trustStoreType=Windows-ROOT   (Windows)
mvn -q -B -f tools/pom.xml dependency:copy-dependencies \
  -DoutputDirectory="$(pwd)/tools/lib" -DincludeScope=runtime

echo "Downloading FHIRHelpers 4.0.1 library..."
curl -fL -o cql/FHIRHelpers.cql \
  "https://raw.githubusercontent.com/cqframework/clinical_quality_language/main/cql-to-elm/src/jvmTest/resources/org/cqframework/cql/cql2elm/fhir/r4/exm108/FHIRHelpers.cql"

echo "Setup complete!"
