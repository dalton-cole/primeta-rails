# Pin npm packages by running ./bin/importmap

pin "application"
pin "@hotwired/turbo-rails", to: "turbo.min.js"
pin "@hotwired/stimulus", to: "stimulus.min.js"
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"
pin_all_from "app/javascript/controllers", under: "controllers"

# Remove the Monaco Editor pins since we're loading it dynamically
# pin "monaco-editor", to: "https://cdn.jsdelivr.net/npm/monaco-editor@0.40.0/min/vs/editor/editor.main.js"
# pin "monaco-editor/esm/vs/editor/editor.api", to: "https://cdn.jsdelivr.net/npm/monaco-editor@0.40.0/esm/vs/editor/editor.api.js"
# pin "monaco-editor/esm/vs/editor/editor.main", to: "https://cdn.jsdelivr.net/npm/monaco-editor@0.40.0/min/vs/editor/editor.main.js"
pin "marked" # @15.0.11
