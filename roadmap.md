# Primeta: Interactive Repository Learning Roadmap

## Overview

Primeta is evolving from a simple code repository viewer into an interactive learning platform that leverages gamification, visualization, and contextual understanding to make code exploration fun, engaging, and educational. This roadmap outlines our vision for transforming technical learning through interactive elements and achievement-based progression.

## Why This Matters

Traditional repository exploration is often intimidating and lacks clear progression paths. By adding game-like elements, contextual visualization, and structured achievements, we create:

1. **Intrinsic motivation** through rewards and progress tracking
2. **Guided learning paths** that introduce concepts progressively
3. **Deeper understanding** through visual relationships and connections
4. **Community engagement** via shared accomplishments and challenges

## Feature Roadmap

### Phase 1: Achievement System

#### Goals
- Create a WoW-inspired achievement framework
- Implement progress tracking and visualization
- Establish reward mechanisms

#### Features
- **Achievement Categories**
  - **Exploration Achievements**: Discovering files, directories, and hidden gems
  - **Learning Achievements**: Completing concept tutorials and quizzes
  - **Feats of Strength**: Mastering complex files and challenging concepts
  - **Progress Achievements**: Time-based learning and completion milestones

- **Achievement UI**
  - Achievement collection view with progress indicators
  - Notification system for earned achievements
  - Bronze/Silver/Gold tiers for progressive accomplishments
  - Personal achievement statistics dashboard

#### Technical Implementation
- Many-to-many relationship between users and achievements
- Progress tracking with incremental updates
- Achievement trigger system based on user actions

### Phase 2: Scavenger Hunt System

#### Goals
- Create an exploration game within the codebase
- Encourage deep diving into file contents
- Make discovery fun and rewarding

#### Features
- **Hidden Elements**
  - Easter eggs embedded in code comments
  - Special tokens requiring specific interactions
  - Code patterns that represent collectible items
  - Multi-file puzzles requiring deep understanding

- **Discovery Mechanics**
  - Monaco editor integration with custom decorations
  - Proximity indicators as users get closer to hidden items
  - Subtle visual cues for discoverable content
  - Progressive hint system for challenging items

- **Hunt Management**
  - Themed scavenger hunts around specific concepts
  - Time-limited special hunts
  - Collaborative hunt challenges
  - Hunt difficulty progression

#### Technical Implementation
- Database storage for scavenger hunt items and their locations
- User discovery tracking
- Monaco editor extensions for item visualization
- Hunt creation and management tools

### Phase 3: Interactive Learning Modules

#### Goals
- Transform static concept documentation into interactive tutorials
- Provide hands-on learning experiences for key concepts
- Create verification mechanisms for concept mastery

#### Features
- **Interactive Concept Tutorials**
  - Step-by-step guided learning paths
  - Code completion exercises
  - Multiple-choice knowledge verification
  - Concept relationship mapping

- **Concept Mastery System**
  - Knowledge testing with adaptive difficulty
  - Retention checks with spaced repetition
  - Practical application challenges
  - Visual progress tracking per concept

#### Technical Implementation
- Content management system for interactive tutorials
- Quiz/challenge framework with verification
- Progress tracking per concept and module

### Phase 4: Repository Visualization and Context

#### Goals
- Provide visual context for code relationships
- Improve understanding of repository architecture
- Make navigation more intuitive through visualization

#### Features
- **Interactive Architecture Diagrams**
  - System-level diagrams showing major components
  - File relationship maps showing dependencies
  - Concept overlay showing where concepts appear across the codebase
  - Click-to-navigate diagram integration

- **Enhanced File Context**
  - "Related Files" section showing dependencies
  - Import/require relationship visualization
  - Function/method call graphs
  - Concept relevance indicators

- **Visual Learning Tools**
  - Diagram-based concept explanations
  - Visual progression through system components
  - Architecture-focused achievement paths
  - Diagram-based scavenger hunts

#### Technical Implementation
- Integration with GitDiagram-like functionality
- Storage of file relationships and dependencies
- Mermaid.js diagram generation during repository sync
- Interactive diagram UI components

## Implementation Plan

Based on analysis of our current codebase, we will implement features in the following order to maximize value while minimizing technical complexity:

### 1. Achievement System (First Priority)

The Achievement System builds directly on our existing file tracking mechanisms and provides immediate engagement benefits.

**Key Integration Points:**
- Extend the `FileView` tracking in `RepositoryFilesController#track_time` 
- Leverage progress calculations in `RepositoriesController#progress`
- Use existing key concept data for learning achievements

**Required New Models:**
```ruby
class Achievement < ApplicationRecord
  has_many :user_achievements
  has_many :users, through: :user_achievements
  
  CATEGORIES = ['exploration', 'learning', 'feat_of_strength', 'progress'].freeze
  
  validates :category, inclusion: { in: CATEGORIES }
end

class UserAchievement < ApplicationRecord
  belongs_to :user
  belongs_to :achievement
  
  validates :progress, numericality: { greater_than_or_equal_to: 0 }
  
  after_save :check_completion
end
```

### 2. Scavenger Hunt System (Second Priority)

The Scavenger Hunt integrates with our Monaco editor implementation and file viewing systems.

**Key Integration Points:**
- Extend Monaco editor in repository file views
- Add decorations and markers for hidden items
- Use existing file path structures for item placement

**Required New Models:**
```ruby
class ScavengerHunt < ApplicationRecord
  belongs_to :repository
  has_many :scavenger_hunt_items
end

class ScavengerHuntItem < ApplicationRecord
  belongs_to :scavenger_hunt
  belongs_to :repository_file
  
  # Location data (line numbers, etc.)
  # Discovery conditions
end

class UserDiscovery < ApplicationRecord
  belongs_to :user
  belongs_to :scavenger_hunt_item
end
```

### 3. Interactive Learning Modules (Third Priority)

Interactive Learning Modules extend our existing `KeyConcept` functionality with interactive elements.

**Key Integration Points:**
- Enhance the `GeminiService` for interactive learning content
- Extend `KeyConcept` model with additional fields
- Add verification logic for challenge completion

**Model Extensions:**
```ruby
# Extensions to KeyConcept
class KeyConcept < ApplicationRecord
  has_many :concept_challenges
  
  # New fields for interactive content
end

class ConceptChallenge < ApplicationRecord
  belongs_to :key_concept
  has_many :user_challenge_completions
end
```

### 4. Repository Visualization (Fourth Priority)

Repository Visualization enhances our sync process to extract and display relationships.

**Key Integration Points:**
- Extend `RepositorySyncJob` to extract relationships during sync
- Integrate with Mermaid.js for diagram generation
- Connect visualizations to concept learning paths

**Required Changes:**
```ruby
# New model for file relationships
class FileRelationship < ApplicationRecord
  belongs_to :source_file, class_name: 'RepositoryFile'
  belongs_to :target_file, class_name: 'RepositoryFile'
  
  # Relationship type and metadata
end

# Extensions to repository sync process
def extract_file_relationships(repo)
  # Analyze imports/requires in files
  # Store relationship data
  # Generate diagram markup
end
```

## Technical Implementation Highlights

1. **Leveraging Existing Systems**
   - File view tracking and time spent metrics (`FileView` model)
   - Key concept identification (`GeminiService`, `KeyConcept`)
   - Monaco editor integration (repository file viewing)
   - Progress tracking (already implemented in controllers)

2. **Database Schema Extensions**
   - Achievement and progress tracking tables
   - File relationship mapping
   - Scavenger hunt items and discoveries
   - Interactive concept challenges

3. **UI Enhancements**
   - Achievement dashboard in user profiles
   - Monaco editor extensions for scavenger hunts
   - Interactive concept learning modules
   - Repository architecture visualizations

## Expected Outcomes

The implementation of this roadmap will transform Primeta into:

1. **A gamified learning environment** that maintains engagement through rewards and challenges
2. **An interactive education platform** that adapts to user progress and provides appropriate challenges
3. **A contextual code exploration tool** that makes understanding complex repositories intuitive
4. **A community-driven learning ecosystem** where users can share achievements and progress

By combining traditional code viewing with game mechanics, interactive learning, and visual context, Primeta will make technical learning more accessible, engaging, and effective. 