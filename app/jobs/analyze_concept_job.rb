class AnalyzeConceptJob < ApplicationJob
  queue_as :default

  def perform(repository_id, concept_names, file_paths = nil)
    repo = Repository.find(repository_id)
    service = GeminiService.new

    # Ensure concept_names is an array
    concept_names = [concept_names] unless concept_names.is_a?(Array)
    
    # Request analysis from Gemini service
    concepts = service.extract_key_concepts_for_codebase(repo, concept_names, file_paths)
    
    # Create new key concepts from the analysis results
    concepts.each do |concept|
      # Check if a concept with this name already exists
      existing_concept = repo.key_concepts.find_by(name: concept["name"])
      
      if existing_concept
        # Update the existing concept
        existing_concept.update!(
          description: concept["description"],
          key_files: concept["key_files"],
          key_files_explanation: concept["key_files_explanation"]
        )
      else
        # Create a new concept
        KeyConcept.create!(
          repository: repo,
          name: concept["name"],
          description: concept["description"],
          key_files: concept["key_files"],
          key_files_explanation: concept["key_files_explanation"]
        )
      end
    end
  end
end 