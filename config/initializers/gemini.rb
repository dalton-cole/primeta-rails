# Gemini API configuration

# Check if Gemini API key is present in credentials
if !Rails.application.credentials.dig(:gemini, :api_key).present?
  puts <<~MESSAGE
    ⚠️  WARNING: Gemini API key not found in Rails credentials.
    The AI assistant's file context feature will not work without it.
    
    Please add it to your credentials with:
    
    rails credentials:edit
    
    And add the following:
    
    gemini:
      api_key: your_gemini_api_key_here
    
    You can obtain a key from the Google AI Studio (https://makersuite.google.com/app/apikey)
  MESSAGE
end

# Configure Gemini API settings
Rails.application.config.gemini = {
  enabled: Rails.application.credentials.dig(:gemini, :api_key).present?,
  model: Rails.application.credentials.dig(:gemini, :model) || "gemini-1.5-flash",
  temperature: Rails.application.credentials.dig(:gemini, :temperature) || 0.2,
  max_tokens: Rails.application.credentials.dig(:gemini, :max_tokens) || 800
} 