# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end

# Create admin user
admin = User.create!(
  email: 'admin@example.com',
  password: 'password',
  name: 'Admin User',
  role: 'admin'
)

# Create regular user
user = User.create!(
  email: 'user@example.com',
  password: 'password',
  name: 'Regular User',
  role: 'user'
)

# Create sample repositories
rails_repo = Repository.create!(
  name: 'Ruby on Rails',
  git_url: 'https://github.com/rails/rails.git',
  url: 'https://github.com/rails/rails',
  description: 'Ruby on Rails is a full-stack web framework optimized for programmer happiness and sustainable productivity.',
  default_branch: 'main',
  status: 'active'
)

react_repo = Repository.create!(
  name: 'React',
  git_url: 'https://github.com/facebook/react.git',
  url: 'https://github.com/facebook/react',
  description: 'A JavaScript library for building user interfaces.',
  default_branch: 'main',
  status: 'active'
)

# Create sample files for Ruby on Rails repository
rails_files = [
  {
    path: 'README.md',
    content: "# Ruby on Rails\n\nRuby on Rails is a web application framework running on the Ruby programming language.",
    size: 94,
    language: 'markdown'
  },
  {
    path: 'Gemfile',
    content: "source 'https://rubygems.org'\n\ngem 'rails', '~> 7.0.0'\ngem 'sqlite3'\ngem 'puma'",
    size: 76,
    language: 'ruby'
  },
  {
    path: 'app/models/application_record.rb',
    content: "class ApplicationRecord < ActiveRecord::Base\n  primary_abstract_class\nend",
    size: 61,
    language: 'ruby'
  },
  {
    path: 'app/controllers/application_controller.rb',
    content: "class ApplicationController < ActionController::Base\n  protect_from_forgery with: :exception\nend",
    size: 81,
    language: 'ruby'
  }
]

rails_files.each do |file_data|
  rails_repo.repository_files.create!(file_data)
end

# Create sample files for React repository
react_files = [
  {
    path: 'README.md',
    content: "# React\n\nReact is a JavaScript library for building user interfaces.",
    size: 65,
    language: 'markdown'
  },
  {
    path: 'package.json',
    content: "{\n  \"name\": \"react\",\n  \"version\": \"18.0.0\",\n  \"license\": \"MIT\"\n}",
    size: 69,
    language: 'json'
  },
  {
    path: 'src/React.js',
    content: "import ReactElement from './ReactElement';\n\nfunction createElement(type, config, children) {\n  return ReactElement(type, config, children);\n}\n\nexport { createElement };",
    size: 159,
    language: 'javascript'
  }
]

react_files.each do |file_data|
  react_repo.repository_files.create!(file_data)
end

# Create file views for the regular user
rails_file = rails_repo.repository_files.find_by(path: 'README.md')
user.file_views.create!(
  repository_file: rails_file,
  view_count: 3,
  last_viewed_at: 2.days.ago,
  total_time_spent: 180 # 3 minutes
)

react_file = react_repo.repository_files.find_by(path: 'README.md')
user.file_views.create!(
  repository_file: react_file,
  view_count: 2,
  last_viewed_at: 1.day.ago,
  total_time_spent: 120 # 2 minutes
)

puts "Seeds created successfully!"
puts "Admin user: admin@example.com / password"
puts "Regular user: user@example.com / password"
