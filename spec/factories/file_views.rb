FactoryBot.define do
  factory :file_view do
    user { nil }
    repository_file { nil }
    view_count { 1 }
    last_viewed_at { "2025-05-05 16:05:43" }
    total_time_spent { 1 }
  end
end
