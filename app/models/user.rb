class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable, :trackable and :omniauthable
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable,
         :omniauthable, omniauth_providers: [:github]
         
  # Associations
  has_many :file_views, dependent: :destroy
  has_many :viewed_files, through: :file_views, source: :repository_file
         
  # Role constants
  ROLES = %w[user admin instructor].freeze
  
  # Validations
  validates :role, inclusion: { in: ROLES }, allow_nil: true
  
  # Protect GitHub username and email from updates once set
  attr_readonly :github_username, :email
  
  before_validation :set_default_role, on: :create
  
  # OmniAuth handler for GitHub
  def self.from_omniauth(auth)
    where(provider: auth.provider, uid: auth.uid).first_or_create do |user|
      user.email = auth.info.email || "#{auth.uid}@github.example.com"
      user.password = Devise.friendly_token[0, 20]
      user.name = auth.info.name
      user.github_username = auth.info.nickname
      user.github_id = auth.uid
    end
  end
  
  def admin?
    role == 'admin'
  end
  
  def instructor?
    role == 'instructor'
  end
  
  private
  
  def set_default_role
    self.role ||= 'user'
  end
end
