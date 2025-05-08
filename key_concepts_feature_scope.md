# Key Concepts Extraction and Display Feature Scope

## Context

The goal is to automatically extract key learning concepts from a codebase after it is synced (or while syncing) using the Gemini API. These concepts will be used to generate learning modules and will be displayed on the repository show page for users. Each concept should include a name, a beginner-friendly description, a list of key files relevant to the concept, and an explanation of why those files are important.

## Goals
- Automatically analyze the entire codebase (not just individual files) after sync.
- Use Gemini API to extract key concepts, their descriptions, and associated key files with explanations.
- Store these concepts in the database, associated with the repository.
- Display the concepts on the repository show page.
- Support future expansion (e.g., admin review, module generation, tagging).

## Data Model

### Table: `key_concepts`
| Field                 | Type    | Description                                      |
|-----------------------|---------|--------------------------------------------------|
| id                    | bigint  | Primary key                                      |
| repository_id         | bigint  | Foreign key to repositories                      |
| name                  | string  | Concept name                                     |
| description           | text    | Concept description                              |
| key_files             | text[]  | Array of file paths relevant to the concept      |
| key_files_explanation | text    | Explanation of why these files are relevant      |
| created_at            | datetime| Timestamp                                        |
| updated_at            | datetime| Timestamp                                        |

### Example Ruby Model
```ruby
class KeyConcept < ApplicationRecord
  belongs_to :repository
  # key_files is a Postgres array of strings
end
```

## Gemini API Prompt

**Prompt Example:**
```
You are an expert programming tutor. Analyze the following codebase and extract a list of the most important concepts, topics, or skills a learner should understand to work with this codebase.

For each concept, provide:
- "name": a short name for the concept
- "description": a short, beginner-friendly explanation
- "key_files": a list of file paths most relevant to this concept
- "key_files_explanation": a short explanation of why these files are relevant to the concept

Respond in JSON as an array:
[
  {
    "name": "...",
    "description": "...",
    "key_files": ["file1.rb", "file2.rb"],
    "key_files_explanation": "..."
  },
  ...
]

Manifest:
# ...file list...

Codebase:
# ...all code...
```

- If the codebase is too large for a single prompt (over 1M tokens), chunk by directory or feature and aggregate results.

## Implementation Steps

### 1. Migration
```ruby
create_table :key_concepts do |t|
  t.references :repository, foreign_key: true
  t.string :name, null: false
  t.text :description, null: false
  t.text :key_files, array: true, default: []
  t.text :key_files_explanation
  t.timestamps
end
```

### 2. GeminiService
- Add `extract_key_concepts_for_codebase(repository)` method:
  - Gather all relevant files (exclude huge, binary, or vendor files)
  - Build manifest and codebase string
  - Estimate token count; trim or chunk if needed
  - Build and send prompt as above
  - Parse JSON response and return array of concepts

### 3. Background Job
- `ExtractKeyConceptsJob`:
  - Triggered after repository sync
  - Calls `GeminiService#extract_key_concepts_for_codebase`
  - Saves each concept to the database

### 4. Controller Integration
- In `RepositoriesController#show`, load `@key_concepts = @repository.key_concepts.order(:name)`

### 5. View Integration
- In `app/views/repositories/show.html.erb`:
```erb
<% if @key_concepts.present? %>
  <section class="key-concepts">
    <h2>Key Concepts</h2>
    <ul>
      <% @key_concepts.each do |concept| %>
        <li>
          <strong><%= concept.name %></strong>
          <p><%= concept.description %></p>
          <% if concept.key_files.present? %>
            <small>Key files: <%= concept.key_files.join(', ') %></small><br>
            <em><%= concept.key_files_explanation %></em>
          <% end %>
        </li>
      <% end %>
    </ul>
  </section>
<% end %>
```
- Add CSS for `.key-concepts` as needed.

### 6. (Optional) Admin Review
- Add an admin interface to review/edit concepts before they are shown to users or used for module generation.

### 7. (Optional) Learning Module Generation
- Use the extracted concepts as the basis for generating learning modules, quizzes, or guided walkthroughs.

## Future Enhancements
- Tag concepts with difficulty, topic, or prerequisites
- Link concepts to specific lines or code snippets
- Allow user feedback on concept clarity
- Use concepts to drive personalized learning paths

## Notes
- With a 1M token input limit, most codebases can be processed in a single Gemini call.
- If the codebase is too large, chunking and aggregation logic will be needed.
- The prompt should be iterated and tested for best results. 