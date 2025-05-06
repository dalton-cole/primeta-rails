FactoryBot.define do
  factory :repository_file do
    repository { nil }
    path { "MyString" }
    content { "MyText" }
    size { 1 }
    language { "MyString" }
    last_updated_at { "2025-05-05 16:05:27" }
  end
end
