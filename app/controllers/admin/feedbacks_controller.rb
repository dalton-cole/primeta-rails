class Admin::FeedbacksController < ApplicationController
  before_action :authenticate_user!
  before_action :verify_admin
  
  def index
    @feedbacks = AiFeedback.includes(:user, :repository)
                          .order(created_at: :desc)
                          .page(params[:page])
                          .per(50)
    
    # Filter by helpful status if specified
    if params[:is_helpful].present?
      is_helpful = (params[:is_helpful] == 'true')
      @feedbacks = @feedbacks.where(is_helpful: is_helpful)
    end
    
    # Filter by content type if specified
    if params[:content_type].present?
      @feedbacks = @feedbacks.where(content_type: params[:content_type])
    end
    
    # Filter by repository if specified
    if params[:repository_id].present?
      @feedbacks = @feedbacks.where(repository_id: params[:repository_id])
    end
    
    # Search by file path
    if params[:file_path].present?
      search_term = "%#{params[:file_path]}%"
      @feedbacks = @feedbacks.where("file_path LIKE ?", search_term)
    end
    
    # Get summary statistics
    @stats = {
      total: AiFeedback.count,
      helpful: AiFeedback.where(is_helpful: true).count,
      not_helpful: AiFeedback.where(is_helpful: false).count,
      context: AiFeedback.where(content_type: 'context').count,
      challenges: AiFeedback.where(content_type: 'challenges').count
    }
    
    # Get list of repositories for filtering
    @repositories = Repository.joins(:ai_feedbacks).distinct.order(:name)
  end
  
  private
  
  def verify_admin
    unless current_user.admin?
      flash[:alert] = "You are not authorized to access this page"
      redirect_to root_path
    end
  end
end
