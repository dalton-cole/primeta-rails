module Gemini
  class CodeExplanationService
    def initialize(api_client = nil)
      @api_client = api_client || Gemini::ApiClient.new
    end
    
    def explain_code(file_path, file_content)
      Rails.logger.info("Explaining code for file: #{file_path}")
      
      prompt = build_explain_prompt(file_path, file_content)
      Rails.logger.info("Prompt created, length: #{prompt.to_s.length} characters")
      
      response = @api_client.send_to_gemini(prompt)
      
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
    
    def suggest_improvements(file_path, file_content)
      Rails.logger.info("Generating improvement suggestions for file: #{file_path}")
      
      prompt = build_suggestions_prompt(file_path, file_content)
      Rails.logger.info("Prompt created, length: #{prompt.to_s.length} characters")
      
      response = @api_client.send_to_gemini(prompt)
      
      if response.dig("candidates", 0, "content", "parts", 0, "text")
        suggestions = response.dig("candidates", 0, "content", "parts", 0, "text")
        Rails.logger.info("Received suggestions, length: #{suggestions.to_s.length} characters")
        suggestions
      else
        Rails.logger.error("Unexpected API response: #{response.inspect}")
        "Unable to generate improvement suggestions for this file."
      end
    rescue => e
      Rails.logger.error("Gemini API error for suggestions: #{e.message}")
      Rails.logger.error(e.backtrace.join("\n"))
      "Error generating suggestions. Please try again later."
    end
    
    def generate_learning_challenges(file_path, file_content, repository = nil)
      Rails.logger.info("Generating learning challenges for file: #{file_path}")
      
      prompt = build_learning_challenges_prompt(file_path, file_content, repository)
      Rails.logger.info("Prompt created, length: #{prompt.to_s.length} characters")
      
      # Use higher maxOutputTokens for challenges
      response = @api_client.send_to_gemini(prompt, generation_config: { maxOutputTokens: 1200 })
      
      if response.dig("candidates", 0, "content", "parts", 0, "text")
        challenges = response.dig("candidates", 0, "content", "parts", 0, "text")
        Rails.logger.info("Received challenges, length: #{challenges.to_s.length} characters")
        challenges
      else
        Rails.logger.error("Unexpected API response: #{response.inspect}")
        "Unable to generate learning challenges for this file."
      end
    rescue => e
      Rails.logger.error("Gemini API error for challenges: #{e.message}")
      Rails.logger.error(e.backtrace.join("\n"))
      "Error generating learning challenges. Please try again later."
    end
    
    private
    
    def build_explain_prompt(file_path, file_content)
      extension = File.extname(file_path)
      language = determine_language(extension)
      
      # Truncate very large files and add note
      original_length = file_content.to_s.length
      max_length = 12000
      truncated = false
      
      if original_length > max_length
        file_content = file_content.to_s[0...max_length]
        truncated = true
        Rails.logger.info("File content truncated from #{original_length} to #{max_length} characters")
      end
      
      truncation_notice = truncated ? "[Note: File was truncated from #{original_length} chars for performance]" : ""
      
      <<~PROMPT
        You are explaining code to a developer exploring a codebase. Be concise and technical.
        
        #{truncation_notice}
        File: #{file_path}
        Language: #{language}
        
        Your task:
        1. Purpose: What does this file do? (1-2 sentences)
        2. Key components: Identify main classes/functions (bullet points)
        3. Notable patterns or techniques used (if any)
        
        IMPORTANT FORMATTING INSTRUCTIONS:
        - Keep under 350 words total
        - Focus on essentials
        - Use markdown formatting for headings, lists, and code snippets
        - DO NOT wrap your entire response in ```markdown blocks
        - Your response will be rendered as markdown directly
        
        Code:
        #{file_content}
      PROMPT
    end
    
    def build_suggestions_prompt(file_path, file_content)
      extension = File.extname(file_path)
      language = determine_language(extension)
      
      # Truncate very large files and add note
      original_length = file_content.to_s.length
      max_length = 12000
      truncated = false
      
      if original_length > max_length
        file_content = file_content.to_s[0...max_length]
        truncated = true
        Rails.logger.info("File content truncated from #{original_length} to #{max_length} characters")
      end
      
      truncation_notice = truncated ? "[Note: File was truncated from #{original_length} chars for performance]" : ""
      
      <<~PROMPT
        Review this code and suggest 2-3 high-impact improvements:
        
        #{truncation_notice}
        File: #{file_path}
        Language: #{language}
        
        For each suggestion:
        - What to improve (1 sentence)
        - Why it matters (1 sentence)
        - Brief code example if relevant
        
        IMPORTANT FORMATTING INSTRUCTIONS:
        - Focus on: performance, security, maintainability, or #{language} best practices
        - Be specific and concise
        - Use markdown formatting for headings, lists, and code snippets
        - DO NOT wrap your entire response in ```markdown blocks
        - Your response will be rendered as markdown directly
        
        Code:
        #{file_content}
      PROMPT
    end
    
    def build_learning_challenges_prompt(file_path, file_content, repository = nil)
      extension = File.extname(file_path)
      language = determine_language(extension)
      
      # Truncate very large files and add note
      original_length = file_content.to_s.length
      max_length = 12000
      truncated = false
      
      if original_length > max_length
        file_content = file_content.to_s[0...max_length]
        truncated = true
        Rails.logger.info("File content truncated from #{original_length} to #{max_length} characters")
      end
      
      # Include brief concept info if available
      concepts_context = if repository && repository.key_concepts.exists?
                          concepts = repository.key_concepts.map do |concept| 
                            concept.name
                          end.join(", ")
                          
                          "Related concepts: #{concepts}"
                        else
                          ""
                        end
      
      truncation_notice = truncated ? "[Note: File was truncated from #{original_length} chars for performance]" : ""
      
      <<~PROMPT
        Create learning challenges for this file:
        
        #{truncation_notice}
        File: #{file_path}
        Language: #{language}
        #{concepts_context}
        
        Provide:
        1. 2 multiple-choice questions about the code
        2. 1 practical coding challenge
        3. 1 extension idea
        
        IMPORTANT FORMATTING INSTRUCTIONS:
        - Keep your response under 800 words
        - Use markdown formatting for headings, lists, and code snippets
        - DO NOT wrap your entire response in ```markdown blocks 
        - Your response will be rendered as markdown directly
        
        Code:
        #{file_content}
      PROMPT
    end
    
    def determine_language(extension)
      case extension.downcase
      when '.rb' then 'Ruby'
      when '.js' then 'JavaScript'
      when '.jsx' then 'React JSX'
      when '.ts' then 'TypeScript'
      when '.tsx' then 'React TypeScript'
      when '.py' then 'Python'
      when '.java' then 'Java'
      when '.c', '.h' then 'C'
      when '.cpp', '.hpp', '.cc' then 'C++'
      when '.cs' then 'C#'
      when '.go' then 'Go'
      when '.rs' then 'Rust'
      when '.php' then 'PHP'
      when '.swift' then 'Swift'
      when '.kt' then 'Kotlin'
      when '.scala' then 'Scala'
      when '.elm' then 'Elm'
      when '.erl' then 'Erlang'
      when '.ex', '.exs' then 'Elixir'
      when '.hs' then 'Haskell'
      when '.html', '.htm' then 'HTML'
      when '.css' then 'CSS'
      when '.scss', '.sass' then 'SCSS/Sass'
      when '.json' then 'JSON'
      when '.xml' then 'XML'
      when '.yaml', '.yml' then 'YAML'
      when '.md' then 'Markdown'
      when '.sql' then 'SQL'
      when '.sh', '.bash' then 'Shell/Bash'
      when '.ps1' then 'PowerShell'
      when '.r' then 'R'
      when '.dart' then 'Dart'
      when '.lua' then 'Lua'
      when '.pl' then 'Perl'
      when '.clj' then 'Clojure'
      else
        # If extension doesn't match known languages, derive from filename
        File.basename(extension).capitalize
      end
    end
  end
end 