module ApplicationHelper
  # Format time spent in seconds to a more readable format
  def format_time_spent(seconds)
    return "0 min" if seconds.nil? || seconds == 0
    
    hours = seconds / 3600
    minutes = (seconds % 3600) / 60
    
    if hours > 0
      "#{hours}h #{minutes}m"
    else
      "#{minutes} min"
    end
  end

  # Helper method to return the GitHub authentication path
  def user_github_omniauth_authorize_path
    Rails.application.routes.url_helpers.user_github_omniauth_authorize_path
  end
end
