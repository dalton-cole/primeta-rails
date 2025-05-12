require 'net/http'
require 'json'

class GeminiService
  def initialize
    @api_client = Gemini::ApiClient.new
    @code_explanation_service = Gemini::CodeExplanationService.new(@api_client)
    @concept_extraction_service = Gemini::ConceptExtractionService.new(@api_client)
  end
  
  # Code explanation methods - delegate to CodeExplanationService
  def explain_code(file_path, file_content)
    @code_explanation_service.explain_code(file_path, file_content)
  end
  
  def suggest_improvements(file_path, file_content)
    @code_explanation_service.suggest_improvements(file_path, file_content)
  end
  
  def generate_learning_challenges(file_path, file_content, repository = nil)
    @code_explanation_service.generate_learning_challenges(file_path, file_content, repository)
  end
  
  # Concept extraction methods - delegate to ConceptExtractionService
  def extract_key_concepts_for_codebase(repository, requested_concepts = nil, file_paths = nil)
    @concept_extraction_service.extract_key_concepts_for_codebase(repository, requested_concepts, file_paths)
  end
  
  def analyze_specific_concept(repository, concept_name, file_paths = nil)
    @concept_extraction_service.analyze_specific_concept(repository, concept_name, file_paths)
  end
  
  # Expose API client method for direct access if needed
  def send_to_gemini(prompt, options = {})
    @api_client.send_to_gemini(prompt, options)
  end
end 