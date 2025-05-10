# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2025_05_10_013418) do
  create_table "ai_feedbacks", force: :cascade do |t|
    t.integer "user_id"
    t.integer "repository_id"
    t.string "file_path"
    t.string "content_type"
    t.boolean "is_helpful"
    t.text "feedback_text"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["is_helpful"], name: "index_ai_feedbacks_on_is_helpful"
    t.index ["repository_id", "file_path", "content_type"], name: "idx_on_repository_id_file_path_content_type_3e9fe1e16d"
    t.index ["repository_id"], name: "index_ai_feedbacks_on_repository_id"
    t.index ["user_id", "repository_id", "file_path", "content_type"], name: "index_ai_feedbacks_on_user_content_uniqueness", unique: true
    t.index ["user_id"], name: "index_ai_feedbacks_on_user_id"
  end

  create_table "ai_response_caches", force: :cascade do |t|
    t.integer "repository_id"
    t.string "file_path"
    t.string "cache_type"
    t.text "content"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["repository_id", "file_path", "cache_type"], name: "index_ai_response_caches_on_repo_file_and_type", unique: true
  end

  create_table "file_views", force: :cascade do |t|
    t.integer "user_id", null: false
    t.integer "repository_file_id", null: false
    t.integer "view_count"
    t.datetime "last_viewed_at"
    t.integer "total_time_spent"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["repository_file_id"], name: "index_file_views_on_repository_file_id"
    t.index ["user_id"], name: "index_file_views_on_user_id"
  end

  create_table "key_concepts", force: :cascade do |t|
    t.integer "repository_id"
    t.string "name", null: false
    t.text "description", null: false
    t.text "key_files"
    t.text "key_files_explanation"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["repository_id"], name: "index_key_concepts_on_repository_id"
  end

  create_table "repositories", force: :cascade do |t|
    t.string "name"
    t.string "url"
    t.text "description"
    t.string "git_url"
    t.string "default_branch"
    t.datetime "last_synced_at"
    t.string "status"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "error_message"
    t.string "current_commit_hash"
  end

  create_table "repository_files", force: :cascade do |t|
    t.integer "repository_id", null: false
    t.string "path"
    t.text "content"
    t.integer "size"
    t.string "language"
    t.datetime "last_updated_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "is_key_file", default: false
    t.index ["is_key_file"], name: "index_repository_files_on_is_key_file"
    t.index ["repository_id"], name: "index_repository_files_on_repository_id"
  end

  create_table "scavenger_hunt_items", force: :cascade do |t|
    t.integer "scavenger_hunt_id", null: false
    t.string "file_path"
    t.integer "line_number"
    t.string "code_element"
    t.text "description"
    t.text "hint"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["scavenger_hunt_id"], name: "index_scavenger_hunt_items_on_scavenger_hunt_id"
  end

  create_table "scavenger_hunts", force: :cascade do |t|
    t.string "title"
    t.text "description"
    t.string "difficulty"
    t.integer "repository_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["repository_id"], name: "index_scavenger_hunts_on_repository_id"
  end

  create_table "user_hunt_completions", force: :cascade do |t|
    t.integer "user_id", null: false
    t.integer "scavenger_hunt_item_id", null: false
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["scavenger_hunt_item_id"], name: "index_user_hunt_completions_on_scavenger_hunt_item_id"
    t.index ["user_id", "scavenger_hunt_item_id"], name: "idx_user_hunt_completions_uniqueness", unique: true
    t.index ["user_id"], name: "index_user_hunt_completions_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "remember_created_at"
    t.string "name"
    t.string "github_id"
    t.string "github_username"
    t.string "role"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "provider"
    t.string "uid"
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
  end

  add_foreign_key "file_views", "repository_files"
  add_foreign_key "file_views", "users"
  add_foreign_key "key_concepts", "repositories"
  add_foreign_key "repository_files", "repositories"
  add_foreign_key "scavenger_hunt_items", "scavenger_hunts"
  add_foreign_key "scavenger_hunts", "repositories"
  add_foreign_key "user_hunt_completions", "scavenger_hunt_items"
  add_foreign_key "user_hunt_completions", "users"
end
