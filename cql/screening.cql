library Screening version '1.0.0'

using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1' called FHIRHelpers

codesystem "LOINC": 'http://loinc.org'
code "Systolic BP": '8480-6' from "LOINC" display 'Systolic blood pressure'

context Patient

define "Is Adult":
  AgeInYears() >= 18

define "Has Recent BP":
  exists (
    [Observation: "Systolic BP"] O
      where O.status.value = 'final' 
        and O.effective.value during Interval[@2026-01-01, @2026-12-31]
  )

define "Needs Screening Alert":
  "Is Adult" and not "Has Recent BP"
