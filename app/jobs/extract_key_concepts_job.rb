class ExtractKeyConceptsJob < ApplicationJob
  queue_as :default

  def perform(repository_id)
    repo = Repository.find(repository_id)
    service = GeminiService.new

    concepts = service.extract_key_concepts_for_codebase(repo)
    concepts.each do |concept|
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