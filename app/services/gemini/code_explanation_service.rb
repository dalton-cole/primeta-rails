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
      
      <<~PROMPT
        You are a technical mentor explaining code to a developer who is exploring this codebase.
        Provide a clear, concise explanation of the following code file.
        
        First, explain the file's purpose and its role in the system.
        Then highlight the key components, functions, or classes in the file.
        Finally, explain any important patterns or techniques used.
        
        Be straightforward and technical, but accessible to developers.
        Keep your explanation under 400 words.
        
        File: #{file_path}
        Language: #{language}
        
        Code:
        #{file_content}
      PROMPT
    end
    
    def build_suggestions_prompt(file_path, file_content)
      extension = File.extname(file_path)
      language = determine_language(extension)
      
      <<~PROMPT
        You are a senior developer providing constructive feedback on code.
        Review the following code file and suggest potential improvements.
        
        Focus on:
        1. Code quality and maintainability
        2. Performance considerations
        3. Security implications
        4. Best practices for #{language}
        5. Design patterns that might be applicable
        
        For each suggestion:
        - Explain why it's an improvement
        - Show a brief example of the improved code when applicable
        - Note the priority (high/medium/low)
        
        Be constructive and practical. Focus on the most impactful improvements.
        
        File: #{file_path}
        Language: #{language}
        
        Code:
        #{file_content}
      PROMPT
    end
    
    def build_learning_challenges_prompt(file_path, file_content, repository = nil)
      extension = File.extname(file_path)
      language = determine_language(extension)
      
      # If repository is provided, include information about its key concepts
      concepts_context = if repository && repository.key_concepts.exists?
                          concepts = repository.key_concepts.map do |concept|
                            "- #{concept.name}: #{concept.description.truncate(100)}"
                          end.join("\n")
                          
                          "This file is part of a repository with these key concepts:\n#{concepts}\n\n"
                        else
                          ""
                        end
      
      <<~PROMPT
        You are creating interactive learning challenges based on a code file.
        Design learning exercises that will help developers understand this code and the concepts it demonstrates.
        
        #{concepts_context}
        File: #{file_path}
        Language: #{language}
        
        Create the following for this code file:
        
        1. QUIZ QUESTIONS (3 multiple-choice questions):
        - Test understanding of the code's purpose and functionality
        - Include questions with varying difficulty
        - Provide the correct answer and explanation for each
        
        2. CODE CHALLENGES (2 practical challenges):
        - Brief description of the task
        - Starting point (code snippets if needed)
        - Hints for completing the task
        - Solution or expected outcomes
        
        3. EXTENSION ACTIVITIES (1-2 ideas):
        - Suggestions for how developers could extend or modify this code
        - What they would learn from this extension
        
        Format each section clearly with headings. Focus on challenges that teach important programming concepts demonstrated in this file.
        
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