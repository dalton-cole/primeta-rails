class HomeController < ApplicationController
  def index
    # Set flash alert message if auth_message parameter is present
    flash.now[:alert] = params[:auth_message] if params[:auth_message].present?
  end
end
