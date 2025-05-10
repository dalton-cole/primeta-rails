class KeyConcept < ApplicationRecord
  belongs_to :repository
  serialize :key_files, coder: YAML
  
  # Validations
  validates :name, presence: true
  validates :description, presence: true
  
  # After save, update all key files' is_key_file flag to true
  after_save :update_key_file_flags
  
  def key_files
    value = self[:key_files]
    if value.is_a?(Array)
      value
    elsif value.nil?
      []
    else
      [value.to_s]
    end
  end
  
  def key_files=(values)
    values = case values
    when Array
      values
    when nil
      []
    else
      [values.to_s]
    end
    
    self[:key_files] = values
  end
  
  private
  
  def update_key_file_flags
    return unless key_files.present?
    
    # Set is_key_file = true for all files in key_files
    repository.repository_files.where(path: key_files).update_all(is_key_file: true)
  end
end 