class CreateFileViews < ActiveRecord::Migration[8.0]
  def change
    create_table :file_views do |t|
      t.references :user, null: false, foreign_key: true
      t.references :repository_file, null: false, foreign_key: true
      t.integer :view_count
      t.datetime :last_viewed_at
      t.integer :total_time_spent

      t.timestamps
    end
  end
end
