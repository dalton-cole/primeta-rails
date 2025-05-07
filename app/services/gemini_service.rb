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
  
  private
  
  def build_explain_prompt(file_path, file_content)
    extension = File.extname(file_path)
    language = determine_language(extension)
    
    "You are a coding assistant explaining code to beginners in simple, easy-to-understand terms.
    Please analyze the following #{language} file and provide:
    1. A simple, beginner-friendly explanation of what this file does (avoid complex jargon)
    2. The main parts of the code explained in simple terms
    3. Basic context on how this fits into the application
    
    File path: #{file_path}
    
    Code:
    ```#{language}
    #{file_content}
    ```
    
    Keep your explanation under 400 words. Use simple language and short sentences. Avoid complex technical terms unless absolutely necessary, and when you do use them, briefly explain what they mean. Imagine you're explaining the code to someone who is just starting to learn programming."
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