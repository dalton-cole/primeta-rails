FactoryBot.define do
  factory :ai_feedback do
    user_id { 1 }
    repository_id { 1 }
    file_path { "MyString" }
    content_type { "MyString" }
    is_helpful { false }
    feedback_text { "MyText" }
  end
end
