class ErrorsController < ApplicationController
  skip_before_action :verify_authenticity_token
  
  def not_found
    respond_to do |format|
      format.html { render status: :not_found }
      format.json { render json: { error: 'Not found' }, status: :not_found }
      format.any { head :not_found }
    end
  end
  
  def internal_server_error
    respond_to do |format|
      format.html { render status: :internal_server_error }
      format.json { render json: { error: 'Internal server error' }, status: :internal_server_error }
      format.any { head :internal_server_error }
    end
  end
end
