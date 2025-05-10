Rails.application.routes.draw do
  # Devise routes with OmniAuth callbacks
  devise_for :users, controllers: {
    omniauth_callbacks: 'users/omniauth_callbacks',
    registrations: 'users/registrations'
  }
  
  # Admin routes
  namespace :admin do
    resources :feedbacks, only: [:index]
  end
  
  # Home controller route
  get "home/index"
  
  # Profile routes
  resources :profiles, only: [:show]
  get "my_profile", to: "profiles#show", as: :my_profile
  
  # Repository routes
  resources :repositories, only: [:index, :show, :new, :create] do
    member do
      post :sync
      post :extract_key_concepts
      post :analyze_concept
      get :tree
    end
    resources :repository_files, only: [:index], controller: 'repositories/repository_files'
    post :track_time, on: :member
    get :progress, on: :member
  end
  
  # Repository file routes
  resources :repository_files, only: [:show] do
    post :track_time, on: :member
    get :content, on: :member
    post :mark_viewed, on: :member
  end
  
  # API routes
  namespace :api do
    get '/file_context', to: 'file_context#show'
    get '/file_suggestions', to: 'file_context#suggestions'
    get '/file_learning_challenges', to: 'file_context#learning_challenges'
    get '/file_related_patterns', to: 'file_context#related_patterns'
    get '/file_visualizations', to: 'file_context#visualizations'
    get '/test_gemini', to: 'file_context#test_gemini'
    post '/submit_feedback', to: 'file_context#submit_feedback'
    get '/check_feedback', to: 'file_context#check_feedback'
  end
  
  # Define the root path route ("/")
  root "home#index"

  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  # Legal pages
  get '/terms', to: 'pages#terms', as: :terms
  get '/privacy', to: 'pages#privacy', as: :privacy
end
