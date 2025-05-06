require 'rails_helper'

RSpec.describe "Repositories::RepositoryFiles", type: :request do
  describe "GET /index" do
    it "returns http success" do
      get "/repositories/repository_files/index"
      expect(response).to have_http_status(:success)
    end
  end

end
