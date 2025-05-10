class HomeController < ApplicationController
  def index
    # Set flash alert message if auth_message parameter is present
    flash.now[:alert] = params[:auth_message] if params[:auth_message].present?

    @featured_repositories = Repository.order(created_at: :desc).limit(6)
  end
end
