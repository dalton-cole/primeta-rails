module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_verified_user
      logger.add_tags "ActionCable", "User #{current_user.id}" if current_user
    end

    private

    def find_verified_user
      # Assumes Devise is used for authentication
      # The `warden.user` key might vary depending on Devise scope (default is :user)
      if (verified_user = env['warden'].user)
        verified_user
      else
        reject_unauthorized_connection
      end
    end
  end
end
