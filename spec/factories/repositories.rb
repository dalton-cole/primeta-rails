FactoryBot.define do
  factory :repository do
    name { "MyString" }
    url { "MyString" }
    description { "MyText" }
    git_url { "MyString" }
    default_branch { "MyString" }
    last_synced_at { "2025-05-05 16:04:35" }
    status { "MyString" }
  end
end
