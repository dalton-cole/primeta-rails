require 'net/http'
require 'json'

module Gemini
  class ApiClient
    # Base Gemini API endpoint
    GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
    
    # Default values if not provided in credentials
    DEFAULT_MODEL = 'gemini-1.5-flash'
    DEFAULT_TEMPERATURE = 0.2
    DEFAULT_MAX_TOKENS = 800
    
    def initialize
      begin
        gemini_config = Rails.application.credentials.gemini
        
        # Check for required API key
        @api_key = gemini_config[:api_key]
        Rails.logger.info("Gemini API key found") if @api_key.present?
        raise "Missing Gemini API key in credentials" unless @api_key.present?
        
        # Load optional configuration with defaults
        @model = gemini_config[:model] || DEFAULT_MODEL
        @default_temperature = gemini_config[:temperature] || DEFAULT_TEMPERATURE
        @default_max_tokens = gemini_config[:max_tokens] || DEFAULT_MAX_TOKENS
        
        Rails.logger.info("Using Gemini model: #{@model}")
        Rails.logger.info("Default temperature: #{@default_temperature}")
        Rails.logger.info("Default max tokens: #{@default_max_tokens}")
      rescue => e
        Rails.logger.error("Failed to initialize Gemini service: #{e.message}")
        Rails.logger.error("Ensure credentials.yml.enc has proper gemini configuration")
        raise
      end
    end
    
    def send_to_gemini(prompt, options = {})
      # Construct the full endpoint URL with the selected model
      endpoint = "#{GEMINI_API_BASE}/#{@model}:generateContent"
      uri = URI("#{endpoint}?key=#{@api_key}")
      
      # Use credentials defaults, but allow overrides from options
      config = {
        temperature: @default_temperature,
        maxOutputTokens: @default_max_tokens
      }.merge(options.fetch(:generation_config, {}))
      
      request_body = {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: config
      }.to_json
      
      # Implement retries using a counter approach instead of retry/redo
      max_retries = options.fetch(:max_retries, 2)
      attempts = 0
      
      while attempts <= max_retries
        attempts += 1
        
        begin
          Rails.logger.info("Sending request to Gemini API (model: #{@model}, temperature: #{config[:temperature]}) - Attempt #{attempts}/#{max_retries + 1}")
          
          http = Net::HTTP.new(uri.host, uri.port)
          http.use_ssl = true
          request = Net::HTTP::Post.new(uri.request_uri, 'Content-Type' => 'application/json')
          request.body = request_body
          
          response = http.request(request)
          
          if response.code.to_i >= 200 && response.code.to_i < 300
            Rails.logger.info("Received successful response from Gemini API")
            return JSON.parse(response.body)
          else
            error_message = "Gemini API error: HTTP #{response.code}"
            Rails.logger.error(error_message)
            Rails.logger.error("Response body: #{response.body}")
            
            # If we should retry and have attempts left, continue to next iteration
            if attempts <= max_retries && should_retry?(response.code.to_i)
              Rails.logger.info("Retrying request after HTTP error (Attempt #{attempts}/#{max_retries + 1})")
              sleep(1.5**attempts) # Exponential backoff
              next # Continue to next iteration
            end
            
            # If we shouldn't retry or have exhausted retries, return error response
            return { "error" => { "code" => response.code.to_i, "message" => error_message } }
          end
        rescue => e
          Rails.logger.error("HTTP request to Gemini API failed: #{e.message}")
          
          # If we have attempts left, continue to next iteration
          if attempts <= max_retries
            Rails.logger.info("Retrying request after exception (Attempt #{attempts}/#{max_retries + 1})")
            sleep(1.5**attempts) # Exponential backoff
            next # Continue to next iteration
          end
          
          # If we've exhausted retries, re-raise the exception
          raise
        end
      end
    end
    
    private
    
    def should_retry?(status_code)
      # Retry on common transient errors
      [429, 500, 502, 503, 504].include?(status_code)
    end
  end
end 