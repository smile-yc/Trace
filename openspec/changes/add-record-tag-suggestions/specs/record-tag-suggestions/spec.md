## Purpose

Helps users reuse secondary tags while creating daily records, reducing repeated typing for similar project work without changing how records store or report tags.

## ADDED Requirements

### Requirement: Derive secondary tag suggestions from history
The system SHALL derive secondary tag suggestions from existing daily record tag text and present them as optional choices in the daily record form.

#### Scenario: Show historical tag suggestions
- **WHEN** the user opens the daily record form and previous records contain secondary tags
- **THEN** the system displays reusable tag suggestions parsed from those previous records

#### Scenario: Keep manual entry available
- **WHEN** the user needs a tag that is not in the suggestions
- **THEN** the system allows the user to type it manually in the same secondary tag field

### Requirement: Prioritize relevant and reusable tags
The system SHALL prioritize tag suggestions that are relevant to the selected project when possible, then fall back to recent or frequently used historical tags.

#### Scenario: Prefer selected project tags
- **WHEN** the user selects a project that has previous records with tags
- **THEN** the system presents tags from that project's previous records before general suggestions

#### Scenario: Show general tags without a project
- **WHEN** the user has not selected a project or the project has no tag history
- **THEN** the system presents general suggestions from historical daily records

### Requirement: Append selected tags without duplicates
The system SHALL let users append suggested tags to the current secondary tag field without duplicating existing tags.

#### Scenario: Add a suggested tag
- **WHEN** the user clicks a suggested tag that is not already present
- **THEN** the system appends that tag to the current secondary tag field using the existing comma-separated format

#### Scenario: Hide or disable already selected tags
- **WHEN** a suggested tag already exists in the current secondary tag field
- **THEN** the system does not add a duplicate tag
