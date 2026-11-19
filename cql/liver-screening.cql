library LiverScreening version '1.0.0'

using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1' called FHIRHelpers

codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMED": 'http://snomed.info/sct'
code "ALT": '1742-6' from "LOINC" display 'Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma'
code "Steatosis of liver": '197321007' from "SNOMED" display 'Steatosis of liver'

context Patient

define "Is Adult":
  AgeInYears() >= 18

define "Has Recent ALT":
  exists (
    [Observation: "ALT"] O
      where O.status.value = 'final'
        and O.effective.value during Interval[@2026-01-01, @2026-12-31]
  )

define "Needs Liver Screening Alert":
  "Is Adult" and not "Has Recent ALT"

define "Has Fatty Liver":
  exists ([Condition: "Steatosis of liver"])

define "Needs Fatty Liver Follow-up Alert":
  "Is Adult" and "Has Fatty Liver" and not "Has Recent ALT"
