FactoryBot.define do
  factory :ai_response_cache do
    repository_id { 1 }
    file_path { "MyString" }
    cache_type { "MyString" }
    content { "MyText" }
  end
end
