require 'rails_helper'

RSpec.describe "RepositoryFiles", type: :request do
  describe "GET /show" do
    it "returns http success" do
      get "/repository_files/show"
      expect(response).to have_http_status(:success)
    end
  end

end
