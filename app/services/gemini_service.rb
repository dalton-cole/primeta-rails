require 'net/http'
require 'json'

class GeminiService
  GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
  
  def initialize
    begin
      @api_key = Rails.application.credentials.gemini[:api_key]
      Rails.logger.info("Gemini API key found") if @api_key.present?
      raise "Missing Gemini API key in credentials" unless @api_key.present?
    rescue => e
      Rails.logger.error("Failed to initialize Gemini service: #{e.message}")
      Rails.logger.error("Ensure credentials.yml.enc has gemini: { api_key: 'your_api_key_here' }")
      raise
    end
  end
  
  def explain_code(file_path, file_content)
    Rails.logger.info("Explaining code for file: #{file_path}")
    
    prompt = build_explain_prompt(file_path, file_content)
    Rails.logger.info("Prompt created, length: #{prompt.to_s.length} characters")
    
    response = send_to_gemini(prompt)
    
    if response.dig("candidates", 0, "content", "parts", 0, "text")
      explanation = response.dig("candidates", 0, "content", "parts", 0, "text")
      Rails.logger.info("Received explanation, length: #{explanation.to_s.length} characters")
      explanation
    else
      Rails.logger.error("Unexpected API response: #{response.inspect}")
      "Unable to generate explanation for this file."
    end
  rescue => e
    Rails.logger.error("Gemini API error: #{e.message}")
    Rails.logger.error(e.backtrace.join("\n"))
    "Error generating explanation. Please try again later."
  end
  
  # Made public for testing
  def send_to_gemini(prompt)
    uri = URI("#{GEMINI_API_ENDPOINT}?key=#{@api_key}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    
    request = Net::HTTP::Post.new(uri.request_uri, 'Content-Type' => 'application/json')
    request.body = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 800
      }
    }.to_json
    
    Rails.logger.info("Sending request to Gemini API")
    response = http.request(request)
    
    if response.code.to_i >= 200 && response.code.to_i < 300
      Rails.logger.info("Received successful response from Gemini API")
    else
      Rails.logger.error("Gemini API error: HTTP #{response.code}")
      Rails.logger.error("Response body: #{response.body}")
    end
    
    JSON.parse(response.body)
  rescue => e
    Rails.logger.error("HTTP request to Gemini API failed: #{e.message}")
    raise
  end
  
  # Extract key concepts for the entire codebase
  def extract_key_concepts_for_codebase(repository, requested_concepts = nil, file_paths = nil)
    # 1. Gather all relevant files (exclude huge, binary, or vendor files)
    files_query = repository.repository_files
      .where("LENGTH(content) < ?", 100_000)
      .where.not("path LIKE ?", "node_modules/%")
      .where.not("path LIKE ?", "vendor/%")
      .where.not("path LIKE ?", "log/%")
      .where.not("path LIKE ?", "tmp/%")
      .where.not("path LIKE ?", "public/%")
      .where.not("path LIKE ?", "dist/%")
      .where.not("path LIKE ?", "build/%")
      .where.not("path LIKE ?", "%.min.%")
      .where.not("path LIKE ?", "%.bundle.%")
    
    # Apply file path filters if provided
    if file_paths.present?
      # Convert file_paths to array if it's a string
      paths = file_paths.is_a?(Array) ? file_paths : [file_paths]
      
      # Build conditions for each path (exact match or directory prefix)
      conditions = paths.map do |path|
        if path.end_with?('/')
          # If path ends with /, treat as directory and match all files in that directory
          repository.repository_files.sanitize_sql_for_conditions(["path LIKE ?", "#{path}%"])
        else
          # Otherwise, treat as exact file path
          repository.repository_files.sanitize_sql_for_conditions(["path = ?", path])
        end
      end
      
      # Join conditions with OR
      if conditions.any?
        files_query = files_query.where(conditions.join(' OR '))
      end
    end
    
    files = files_query

    # Log stats on the repository files
    Rails.logger.info("Repository has #{files.count} files for analysis")
    
    # Determine if this is a small/minimal repo or a significant codebase
    is_minimal_repo = files.count < 10
    
    # Create a manifest of all files for reference
    manifest = files.map { |f| "#{f.path} (#{f.language})" }.join("\n")
    
    # Set a strict token limit (Gemini's limit is ~1M tokens)
    max_tokens = 800_000
    
    # Sort files by potential importance
    sorted_files = files.sort_by do |f|
      size_score = f.content.length
      # Prioritize key files and common important files like app entry points
      importance_multiplier = if f.is_key_file
                              0.2
                            elsif f.path.match?(/^(app\/models\/|app\/controllers\/|lib\/|src\/|main\.)/i)
                              0.5
                            elsif f.path.match?(/^(spec\/|test\/|\.github\/|\.circleci\/)/i)
                              2.0
                            else
                              1.0
                            end
      size_score * importance_multiplier
    end
    
    # Build code snippets staying under the token limit
    code_snippets = ""
    selected_files = []
    running_tokens = 0
    
    sorted_files.each do |f|
      snippet = "\n# #{f.path}\n#{f.content}"
      # Estimate tokens conservatively
      tokens = snippet.length / 3
      
      if running_tokens + tokens > max_tokens
        next
      end
      
      code_snippets << snippet
      selected_files << f
      running_tokens += tokens
      
      # Break early if we're getting close to the limit
      break if running_tokens > max_tokens * 0.95
    end
    
    # Update manifest to only include selected files
    manifest = selected_files.map { |f| "#{f.path} (#{f.language})" }.join("\n")
    
    Rails.logger.info("Selected #{selected_files.size} files out of #{files.size} for key concept extraction")
    Rails.logger.info("Estimated token count: #{running_tokens}")

    # Modify the prompt based on whether specific concepts were requested
    prompt = if requested_concepts.present?
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
    elsif is_minimal_repo
      # For minimal repos - limit description length
      <<~PROMPT
        You are analyzing a small codebase to identify its key functional aspects. This appears to be a simple or starter application with limited files.

        Based on the code provided, identify 3-5 key concepts that would help a developer understand this codebase. Since this is a minimal application, it's acceptable to include some framework-level concepts that are essential to understanding how this specific application works.

        For each concept, provide:
        - "name": a short descriptive name for the concept (under 50 characters)
        - "description": a brief explanation focusing on how this specific application implements or uses the concept (under 250 characters)
        - "key_files": a list of relevant file paths
        - "key_files_explanation": a short explanation of how these files contribute to the concept (under 200 characters)

        Return your answer as a JSON array.

        Files:
        #{manifest}

        Code:
        #{code_snippets}
      PROMPT
    else
      # For substantial repos - limit description length
      <<~PROMPT
        You are an expert software architect analyzing a substantial codebase to document its core functionality for developers. Extract the most important IMPLEMENTATION-SPECIFIC concepts that make this codebase unique.

        IMPORTANT GUIDELINES:
        1. DO NOT focus on general tech stack elements (e.g., "Ruby on Rails", "SQLite", "MVC pattern")
        2. DO focus on the specific implementation details that are unique to this codebase
        3. Emphasize CONCRETE FUNCTIONALITY rather than abstract concepts
        4. Analyze data structures, workflows, business logic, and domain-specific solutions

        For each concept, provide:
        - "name": a specific name that describes the functionality (under 50 characters)
        - "description": an explanation of how it's implemented in this codebase (under 250 characters)
        - "key_files": a list of file paths directly involved (limit to 3-5 most important files)
        - "key_files_explanation": a short explanation of how these files interact (under 200 characters)

        IMPORTANT: Keep all descriptions brief and concise to ensure your response is not too large.
        Respond with ONLY the JSON array, with no surrounding code blocks or markdown formatting.

        Manifest:
        #{manifest}

        Codebase:
        #{code_snippets}
      PROMPT
    end

    response = send_to_gemini(prompt)
    text = response.dig("candidates", 0, "content", "parts", 0, "text")
    
    # Clean the text to handle cases where it includes markdown code blocks
    cleaned_text = if text.present?
      # Remove code block markers if present
      text = text.gsub(/```(json|javascript|ruby)?/, '')
      # Trim whitespace
      text = text.strip
      # Handle cases where the first character isn't a [
      text = text[text.index('[')..] if text.present? && text.include?('[') && !text.start_with?('[')
      text
    else
      "[]"
    end
    
    begin
      JSON.parse(cleaned_text)
    rescue => e
      Rails.logger.error("Failed to parse Gemini response as JSON: #{e.message}")
      Rails.logger.error("Original text: #{text.inspect}")
      Rails.logger.error("Cleaned text: #{cleaned_text.inspect}")
      
      # Manually fix the malformed JSON if possible (try to find complete concepts)
      manual_concepts = []
      
      # Try to extract valid concepts before the JSON error
      if cleaned_text.present? && cleaned_text.start_with?('[')
        # Find complete objects in the array
        concept_regex = /{[^}]*"name"[^}]*"description"[^}]*"key_files"[^}]*"key_files_explanation"[^}]*}/
        cleaned_text.scan(concept_regex) do |concept_match|
          begin
            # Try to parse each concept individually
            concept_json = "[#{concept_match}]"
            concept = JSON.parse(concept_json).first
            manual_concepts << concept
          rescue
            # Skip this concept if it can't be parsed
          end
        end
      end
      
      # If we can't extract any valid concepts, create some basic placeholders
      if manual_concepts.empty?
        # Create fallback concepts based on directory structure
        top_dirs = repository.repository_files.pluck(:path).map { |p| p.split('/').first }.uniq.compact
        
        manual_concepts = top_dirs.first(5).map do |dir|
          {
            "name" => "#{dir.capitalize} Component",
            "description" => "This component contains functionality related to #{dir}.",
            "key_files" => repository.repository_files.where("path LIKE ?", "#{dir}/%").limit(3).pluck(:path),
            "key_files_explanation" => "These are key files in the #{dir} directory."
          }
        end
      end
      
      manual_concepts
    end
  end
  
  # Analyze a specific concept in the codebase
  def analyze_specific_concept(repository, concept_name, file_paths = nil)
    # Use the same file selection logic as in extract_key_concepts_for_codebase
    # but with a more targeted prompt
    extract_key_concepts_for_codebase(repository, [concept_name], file_paths)
  end
  
  # Generate code improvement suggestions for a file
  def suggest_improvements(file_path, file_content)
    Rails.logger.info("Generating improvement suggestions for file: #{file_path}")
    
    prompt = build_suggestions_prompt(file_path, file_content)
    Rails.logger.info("Prompt created, length: #{prompt.to_s.length} characters")
    
    response = send_to_gemini(prompt)
    
    if response.dig("candidates", 0, "content", "parts", 0, "text")
      suggestions = response.dig("candidates", 0, "content", "parts", 0, "text")
      Rails.logger.info("Received suggestions, length: #{suggestions.to_s.length} characters")
      suggestions
    else
      Rails.logger.error("Unexpected API response: #{response.inspect}")
      "Unable to generate suggestions for this file."
    end
  rescue => e
    Rails.logger.error("Gemini API error: #{e.message}")
    Rails.logger.error(e.backtrace.join("\n"))
    "Error generating suggestions. Please try again later."
  end
  
  # Generate learning challenges for a file
  def generate_learning_challenges(file_path, file_content, repository = nil)
    Rails.logger.info("Generating learning challenges for file: #{file_path}")
    
    prompt = build_learning_challenges_prompt(file_path, file_content, repository)
    Rails.logger.info("Prompt created, length: #{prompt.to_s.length} characters")
    
    response = send_to_gemini(prompt)
    
    if response.dig("candidates", 0, "content", "parts", 0, "text")
      challenges = response.dig("candidates", 0, "content", "parts", 0, "text")
      Rails.logger.info("Received learning challenges, length: #{challenges.to_s.length} characters")
      challenges
    else
      Rails.logger.error("Unexpected API response: #{response.inspect}")
      "Unable to generate learning challenges for this file."
    end
  rescue => e
    Rails.logger.error("Gemini API error: #{e.message}")
    Rails.logger.error(e.backtrace.join("\n"))
    "Error generating learning challenges. Please try again later."
  end
  
  # Find related patterns in the codebase
  def find_related_patterns(file_path, file_content, repository)
    Rails.logger.info("Finding related patterns for file: #{file_path}")
    
    prompt = build_related_patterns_prompt(file_path, file_content, repository)
    Rails.logger.info("Prompt created, length: #{prompt.to_s.length} characters")
    
    response = send_to_gemini(prompt)
    
    if response.dig("candidates", 0, "content", "parts", 0, "text")
      patterns = response.dig("candidates", 0, "content", "parts", 0, "text")
      Rails.logger.info("Received related patterns, length: #{patterns.to_s.length} characters")
      patterns
    else
      Rails.logger.error("Unexpected API response: #{response.inspect}")
      "Unable to find related patterns for this file."
    end
  rescue => e
    Rails.logger.error("Gemini API error: #{e.message}")
    Rails.logger.error(e.backtrace.join("\n"))
    "Error finding related patterns. Please try again later."
  end
  
  # Generate conceptual visualizations descriptions
  def generate_visualizations(file_path, file_content, repository = nil)
    Rails.logger.info("Generating visualizations for file: #{file_path}")
    
    prompt = build_visualizations_prompt(file_path, file_content, repository)
    Rails.logger.info("Prompt created, length: #{prompt.to_s.length} characters")
    
    response = send_to_gemini(prompt)
    
    if response.dig("candidates", 0, "content", "parts", 0, "text")
      visualizations = response.dig("candidates", 0, "content", "parts", 0, "text")
      Rails.logger.info("Received visualizations, length: #{visualizations.to_s.length} characters")
      visualizations
    else
      Rails.logger.error("Unexpected API response: #{response.inspect}")
      "Unable to generate visualizations for this file."
    end
  rescue => e
    Rails.logger.error("Gemini API error: #{e.message}")
    Rails.logger.error(e.backtrace.join("\n"))
    "Error generating visualizations. Please try again later."
  end
  
  private
  
  def build_explain_prompt(file_path, file_content)
    extension = File.extname(file_path)
    language = determine_language(extension)
    
    "You are Primeta AI, a witty and insightful coding assistant with a personality.
    Analyze the following #{language} file and provide:
    1. A concise explanation of what this file does (be friendly and conversational)
    2. The main parts of the code explained in clear terms with code examples
    3. Context on how this fits into the application
    4. At least one interesting insight, tip, or best practice related to this code
    
    File path: #{file_path}
    
    Code:
    ```#{language}
    #{file_content}
    ```
    
    Format your explanation with appropriate Markdown for code snippets, headings, and bullet points.
    Keep your explanation under 400 words. Use friendly language and add a touch of personality.
    Occasionally use emoji where appropriate to make key points stand out. 🚀
    Always highlight important code segments using proper Markdown syntax highlighting for #{language}."
  end
  
  def build_suggestions_prompt(file_path, file_content)
    extension = File.extname(file_path)
    language = determine_language(extension)
    
    <<~PROMPT
      You are an expert software engineer reviewing code. Analyze the following #{language} file and provide:
      
      1. 3-5 specific improvement suggestions (focus on maintainability, performance, and best practices)
      2. For each suggestion, include a code example showing how to implement it
      3. Explain the benefits of each improvement
      
      File path: #{file_path}
      
      Code:
      ```#{language}
      #{file_content}
      ```
      
      Format your response as follows:
      
      # Code Improvement Suggestions
      
      ## Suggestion 1: [Brief Title]
      [Explanation of what can be improved]
      
      ```#{language}
      [Code example showing the improvement]
      ```
      
      **Benefit:** [Explain the concrete benefit]
      
      ## Suggestion 2: [Brief Title]
      ...
      
      Keep your suggestions practical and specific to this file. Focus on improvements that would have the most impact.
    PROMPT
  end
  
  def build_learning_challenges_prompt(file_path, file_content, repository = nil)
    extension = File.extname(file_path)
    language = determine_language(extension)
    
    <<~PROMPT
      You are a skilled programming instructor. Create engaging learning challenges based on this #{language} file to deepen understanding:

      File path: #{file_path}
      
      Code:
      ```#{language}
      #{file_content}
      ```
      
      Create 3-5 learning challenges that:
      1. Test fundamental understanding of what this code does
      2. Explore edge cases or interesting scenarios
      3. Encourage thinking about the code's behavior if modified
      
      For each challenge:
      - Provide a clear question with context
      - Include multiple-choice options (where appropriate)
      - Provide an answer with explanation
      
      Format your response as follows:
      
      # Learning Challenges
      
      ## Challenge 1: [Brief Title]
      **Question:** [Question text]
      
      **Options:**
      - A) [Option text]
      - B) [Option text]
      - C) [Option text]
      - D) [Option text]
      
      **Answer:** [Correct option letter]
      
      **Explanation:** [Detailed explanation of why this is correct and what we learn]
      
      ## Challenge 2: [Brief Title]
      ...
      
      Make challenges informative and helpful for learning the concepts in this file.
    PROMPT
  end
  
  def build_related_patterns_prompt(file_path, file_content, repository)
    extension = File.extname(file_path)
    language = determine_language(extension)
    
    # Get key file paths from repository
    key_concepts = repository&.key_concepts || []
    key_files = []
    
    key_concepts.each do |concept|
      key_files.concat(concept.key_files) if concept.key_files.present?
    end
    
    key_files = key_files.uniq.join(", ")
    
    <<~PROMPT
      You are a code pattern expert analyzing how patterns relate across a codebase. For this #{language} file, identify related patterns:

      File path: #{file_path}
      
      Code:
      ```#{language}
      #{file_content}
      ```
      
      Some key files in this repository include: #{key_files}
      
      Identify 3-4 design patterns, coding patterns, or architectural patterns that:
      1. Are demonstrated in this file
      2. Likely appear in other parts of this codebase
      3. Are important to understand for working with similar codebases
      
      For each pattern:
      - Name and describe the pattern
      - Explain how it's used in this specific file
      - Suggest where else it might appear in the codebase
      - Explain the benefits of understanding this pattern
      
      Format your response as follows:
      
      # Related Patterns
      
      ## Pattern 1: [Pattern Name]
      
      **Description:** [Brief description of what this pattern is]
      
      **In this file:** [How it's used here, with specific line references]
      
      **Elsewhere:** [Where else this pattern likely appears]
      
      **Why it matters:** [Why understanding this pattern helps developers]
      
      ## Pattern 2: [Pattern Name]
      ...
      
      Make your analysis insightful and focused on understanding the codebase better.
    PROMPT
  end
  
  def build_visualizations_prompt(file_path, file_content, repository = nil)
    extension = File.extname(file_path)
    language = determine_language(extension)
    
    <<~PROMPT
      You are an expert at visualizing code architecture. For this #{language} file, describe conceptual visualizations:

      File path: #{file_path}
      
      Code:
      ```#{language}
      #{file_content}
      ```
      
      Generate 2-3 detailed descriptions of visual diagrams that would help understand:
      1. This file's role in the overall system
      2. The data/control flow within and around this file
      3. Key relationships and interactions
      
      For each visualization:
      - Provide a clear title for the diagram
      - Describe what the diagram shows in detail (components, connections, processes)
      - Explain what insights someone would gain from viewing this visualization
      - Include a text-based ASCII representation of the diagram where possible
      
      Format your response as follows:
      
      # Conceptual Visualizations
      
      ## Visualization 1: [Diagram Title]
      
      **Description:** [Detailed description of what the visualization shows]
      
      **Insights:** [What someone would learn from viewing this]
      
      **Diagram:**
      ```
      [ASCII diagram representation]
      ```
      
      ## Visualization 2: [Diagram Title]
      ...
      
      Make visualizations that would genuinely enhance understanding of the code's structure and purpose.
    PROMPT
  end
  
  def determine_language(extension)
    case extension.downcase
    when '.rb'
      'ruby'
    when '.js'
      'javascript'
    when '.ts'
      'typescript'
    when '.py'
      'python'
    when '.html'
      'html'
    when '.css'
      'css'
    when '.scss'
      'scss'
    when '.erb'
      'erb'
    else
      'code'
    end
  end
end 