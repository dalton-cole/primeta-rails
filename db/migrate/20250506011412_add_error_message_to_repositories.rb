class AddErrorMessageToRepositories < ActiveRecord::Migration[8.0]
  def change
    add_column :repositories, :error_message, :text
  end
end
