class Users::RegistrationsController < Devise::RegistrationsController
  before_action :configure_account_update_params, only: [:update]

  protected

  # Override the update resource to allow password change without the email field
  def update_resource(resource, params)
    return super if params[:password].present?
    
    # Update without password and without updating email
    params.delete(:email)
    params.delete(:current_password)
    params.delete(:github_username) if resource.github_username.present?
    
    resource.update_without_password(params)
  end

  # If you have extra params to permit, append them to the sanitizer.
  def configure_account_update_params
    devise_parameter_sanitizer.permit(:account_update, keys: [:name])
  end
end 