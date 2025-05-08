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
end
