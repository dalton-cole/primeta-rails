module Gemini
  class ConceptExtractionService
    def initialize(api_client = nil)
      @api_client = api_client || Gemini::ApiClient.new
    end
    
    # Extract key concepts for the entire codebase
    def extract_key_concepts_for_codebase(repository, requested_concepts = nil, file_paths = nil)
      # Gather relevant files using the FileSelectionService
      file_selection_service = Gemini::FileSelectionService.new
      selected_files, manifest, code_snippets = file_selection_service.select_files_for_analysis(repository, file_paths)
      
      Rails.logger.info("Selected #{selected_files.size} files for key concept extraction")
      
      # Is this a small/minimal repo?
      is_minimal_repo = selected_files.count < 10
      
      # Build the appropriate prompt
      prompt = if requested_concepts.present?
        build_requested_concepts_prompt(requested_concepts, manifest, code_snippets)
      elsif is_minimal_repo
        build_minimal_repo_prompt(manifest, code_snippets)
      else
        build_standard_repo_prompt(manifest, code_snippets)
      end
      
      # Send to Gemini API
      response = @api_client.send_to_gemini(prompt)
      
      # Process the response
      begin
        if response.dig("candidates", 0, "content", "parts", 0, "text")
          content = response.dig("candidates", 0, "content", "parts", 0, "text")
          
          # Clean the response to ensure it's valid JSON
          json_content = clean_json_response(content)
          
          # Parse JSON response
          concepts = JSON.parse(json_content)
          
          # Validate and clean up the concepts data
          concepts = Array(concepts)
          concepts.map do |concept|
            # Ensure key_files is always an array even if empty
            concept["key_files"] = Array(concept["key_files"])
            concept
          end
        else
          Rails.logger.error("Unexpected API response format: #{response.inspect}")
          []
        end
      rescue JSON::ParserError => e
        Rails.logger.error("Failed to parse concept extraction response: #{e.message}")
        Rails.logger.error("Raw response: #{response.dig('candidates', 0, 'content', 'parts', 0, 'text')}")
        []
      end
    end
    
    # Analyze a specific concept
    def analyze_specific_concept(repository, concept_name, file_paths = nil)
      extract_key_concepts_for_codebase(repository, [concept_name], file_paths)
    end
    
    private
    
    def build_requested_concepts_prompt(requested_concepts, manifest, code_snippets)
      concepts_list = requested_concepts.join(", ")
      <<~PROMPT
        You are analyzing a codebase to identify how it implements specific requested concepts. The user has requested information about these concepts: #{concepts_list}.

        For EACH of the requested concepts, provide:
        - "name": the exact name of the concept as provided in the list (#{concepts_list})
        - "description": a detailed technical explanation of how this codebase implements the concept (under 250 characters)
        - "key_files": a list of the most relevant file paths that implement this concept (3-5 files maximum)
        - "key_files_explanation": an explanation of how these files work together to implement the concept (under 200 characters)

        IMPORTANT: If a requested concept IS NOT FOUND in the codebase:
        1. Still include it in your response
        2. Set "description" to "This concept could not be found in the analyzed code. It might be implemented differently or use alternative terminology."
        3. Suggest related concepts or terms that might be present in the codebase in the "key_files_explanation" field
        4. Include any files that might be tangentially related to the concept in "key_files"

        IMPORTANT: Keep all descriptions brief and concise to ensure your response is not too large.
        Respond with ONLY the JSON array, with no surrounding code blocks or markdown formatting.

        Files:
        #{manifest}

        Code:
        #{code_snippets}
      PROMPT
    end
    
    def build_minimal_repo_prompt(manifest, code_snippets)
      <<~PROMPT
        You are analyzing a small codebase to identify its key concepts, patterns, and architecture.

        Provide an analysis with these key concepts:
        1. Core functionality and purpose
        2. Data structures and key models
        3. Main architectural patterns
        4. Notable libraries or frameworks used
        5. Main program flow or execution path

        For EACH concept you identify, provide:
        - "name": a short, descriptive name for the concept (under 50 characters)
        - "description": a detailed explanation of how this is implemented (under 250 characters)
        - "key_files": a list of important file paths for this concept (1-3 files)
        - "key_files_explanation": how these files implement the concept (under 200 characters)

        Focus on high-level concepts that help understand the codebase. 
        Keep descriptions concise and technical.
        Respond with ONLY a JSON array of concepts, no surrounding text.

        Files:
        #{manifest}

        Code:
        #{code_snippets}
      PROMPT
    end
    
    def build_standard_repo_prompt(manifest, code_snippets)
      <<~PROMPT
        You are analyzing a codebase to identify its key concepts, patterns, and architecture.

        Extract 5-8 key concepts that would help a developer understand this codebase. For each concept, provide:
        - "name": a short, descriptive name for the concept (under 50 characters)
        - "description": a detailed explanation of how this concept is implemented (under 250 characters)
        - "key_files": a list of the most relevant file paths for this concept (3-5 files maximum)
        - "key_files_explanation": an explanation of how these files implement the concept (under 200 characters)

        Focus on concepts that are:
        1. Core to the application's functionality
        2. Architectural patterns or design decisions
        3. Important data models and their relationships
        4. Key business logic implementations
        5. Critical interfaces or integration points

        IMPORTANT:
        - Keep descriptions brief but informative
        - Each concept should represent a distinct aspect of the codebase
        - Identify the most relevant files for each concept
        - Prioritize files with substantive implementation over simple utility files

        Respond with ONLY the JSON array, with no surrounding code blocks or markdown formatting.

        Files:
        #{manifest}

        Code:
        #{code_snippets}
      PROMPT
    end
    
    def clean_json_response(content)
      # Remove any markdown code blocks if present
      content = content.gsub(/```(?:json)?\s*\n?/, "").gsub(/```\s*\n?$/, "")
      
      # Remove any explanatory text before or after the JSON
      if content.include?('[') && content.include?(']')
        start_idx = content.index('[')
        end_idx = content.rindex(']')
        content = content[start_idx..end_idx] if start_idx && end_idx
      end
      
      content.strip
    end
  end
end 