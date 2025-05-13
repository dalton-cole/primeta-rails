class Rack::Attack
  ### Configure Rate Limits for AI APIs
  
  # Throttle file_context API requests by IP to prevent hammering the database
  # Limit to 10 requests per 10 seconds per IP (burst protection)
  # Allow a slightly higher rate for users who are logged in
  
  # Throttle for AI context API 
  throttle('ai_api/file_context/ip', limit: 10, period: 10.seconds) do |req|
    if req.path.start_with?('/api/file_context') || req.path.start_with?('/api/file_learning_challenges')
      req.ip
    end
  end
  
  # Throttle per user for authenticated requests
  throttle('ai_api/file_context/user', limit: 15, period: 10.seconds) do |req|
    if (req.path.start_with?('/api/file_context') || req.path.start_with?('/api/file_learning_challenges')) && req.env['warden']
      # Authenticated users - rate limit by user id
      user = req.env['warden'].user
      user ? "user:#{user.id}" : nil 
    end
  end
  
  # Block IPs making excessive AI API requests
  # This targets repeated abuse by blocking for a longer period
  blocklist('excessive_ai_api_usage/ip') do |req|
    Rack::Attack::Allow2Ban.filter(req.ip, maxretry: 30, findtime: 1.minute, bantime: 5.minutes) do
      req.path.start_with?('/api/file_context') || req.path.start_with?('/api/file_learning_challenges')
    end
  end
  
  ### Response Configuration
  
  # Return a 429 Too Many Requests response for throttled requests
  self.throttled_response = lambda do |env|
    request = ActionDispatch::Request.new(env)
    match_data = env['rack.attack.match_data']
    now = match_data[:epoch_time]
    retry_after = match_data[:period] - (now % match_data[:period])
    
    headers = {
      'Content-Type' => 'application/json',
      'Retry-After' => retry_after.to_s
    }
    
    [ 429, headers, [{ error: "Rate limit exceeded. Please retry in #{retry_after} seconds."}.to_json]]
  end
end 