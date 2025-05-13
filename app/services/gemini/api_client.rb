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
    
    # Cache settings
    REQUEST_CACHE_TTL = 86400 # 24 hours
    
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
        
        # Initialize in-memory request cache
        @request_cache = {}
        
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
      # Generate a cache key based on the prompt and options
      cache_key = generate_cache_key(prompt, options)
      
      # Check if we have a cached response
      cached_response = check_cache(cache_key)
      return cached_response if cached_response
      
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
          
          # Create a persistent HTTP connection to improve response times
          http = Net::HTTP.new(uri.host, uri.port)
          http.use_ssl = true
          http.read_timeout = 30 # Increase timeout for large responses
          http.open_timeout = 10
          request = Net::HTTP::Post.new(uri.request_uri, 'Content-Type' => 'application/json')
          request.body = request_body
          
          response = http.request(request)
          
          if response.code.to_i >= 200 && response.code.to_i < 300
            Rails.logger.info("Received successful response from Gemini API")
            parsed_response = JSON.parse(response.body)
            # Cache successful responses
            cache_response(cache_key, parsed_response)
            return parsed_response
          else
            error_message = "Gemini API error: HTTP #{response.code}"
            Rails.logger.error(error_message)
            Rails.logger.error("Response body: #{response.body}")
            
            # If we should retry and have attempts left, continue to next iteration
            if attempts <= max_retries && should_retry?(response.code.to_i)
              backoff_time = calculate_backoff(attempts)
              Rails.logger.info("Retrying request after HTTP error (Attempt #{attempts}/#{max_retries + 1}) - waiting #{backoff_time}s")
              sleep(backoff_time) # Exponential backoff
              next # Continue to next iteration
            end
            
            # If we shouldn't retry or have exhausted retries, return error response
            return { "error" => { "code" => response.code.to_i, "message" => error_message } }
          end
        rescue => e
          Rails.logger.error("HTTP request to Gemini API failed: #{e.message}")
          
          # If we have attempts left, continue to next iteration
          if attempts <= max_retries
            backoff_time = calculate_backoff(attempts)
            Rails.logger.info("Retrying request after exception (Attempt #{attempts}/#{max_retries + 1}) - waiting #{backoff_time}s")
            sleep(backoff_time) # Exponential backoff
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
    
    def calculate_backoff(attempt)
      # Exponential backoff with jitter to prevent concurrent retries
      # Base: 1.5^attempt with random jitter of 0-500ms
      base = 1.5**attempt
      jitter = rand(0..0.5)
      base + jitter
    end
    
    def generate_cache_key(prompt, options)
      # Create a unique key based on the prompt and generation settings
      config = options.fetch(:generation_config, {})
      key_parts = [
        prompt[0..100], # First 100 chars of prompt to avoid huge cache keys
        @model,
        config[:temperature] || @default_temperature,
        config[:maxOutputTokens] || @default_max_tokens
      ]
      Digest::MD5.hexdigest(key_parts.join('|'))
    end
    
    def check_cache(cache_key)
      cached = @request_cache[cache_key]
      if cached && (Time.now.to_i - cached[:timestamp] < REQUEST_CACHE_TTL)
        Rails.logger.info("Using cached Gemini API response")
        cached[:response]
      else
        nil
      end
    end
    
    def cache_response(cache_key, response)
      @request_cache[cache_key] = {
        response: response,
        timestamp: Time.now.to_i
      }
      
      # Limit cache size by pruning old entries if needed
      if @request_cache.size > 100
        # Remove oldest entries
        @request_cache = @request_cache.sort_by { |_, v| v[:timestamp] }.last(50).to_h
      end
    end
  end
end 