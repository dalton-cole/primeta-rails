# AI Assistant & Exercise Module Scope Document

## Overview
Implement an AI assistant in the bottom right corner of the application that provides context on files being viewed and their relation to the codebase. Additionally, create an exercise module system where AI generates coding exercises related to concepts in the codebase, with achievements for users who complete them.

## Core Components

### 1. AI Assistant UI
- Floating assistant in bottom right corner
- Toggle button to show/hide the assistant
- Tabbed interface with "File Context" and "Exercises" sections
- Context storage to avoid repetitive generation

### 2. File Context Generation
- Integration with Gemini 2.5 Flash API
- Analysis of file content to provide relevant context
- Persistent storage of generated context
- Cache system to avoid redundant API calls

### 3. Exercise Module System
- AI-generated coding exercises based on file content
- Multiple difficulty levels (beginner, intermediate, advanced)
- Exercise completion tracking
- Achievement system for completed exercises

## Technical Requirements

### Database Models
1. **FileContext**
   - `file_path` (string)
   - `context` (text)
   - `repository_id` (integer)
   - Belongs to Repository

2. **CodeExercise**
   - `title` (string)
   - `description` (text)
   - `difficulty` (string)
   - `file_path` (string)
   - `repository_id` (integer)
   - `solution` (text)
   - `hint` (text)
   - Belongs to Repository
   - Has many UserAchievements

3. **UserAchievement**
   - `user_id` (integer)
   - `code_exercise_id` (integer)
   - `completed_at` (datetime)
   - Belongs to User
   - Belongs to CodeExercise

### API Endpoints
1. **File Context**
   - `GET /api/file_context?file_path=path/to/file` - Retrieve context for a file
   
2. **Exercises**
   - `GET /api/file_exercises?file_path=path/to/file` - Get exercises for a file
   - `POST /api/complete_exercise` - Mark an exercise as completed

### Frontend Components
1. **AI Assistant Component**
   - Toggle button in bottom right corner
   - Expandable panel with tabs
   - Context display area
   - Exercise listing

2. **Exercise View**
   - Exercise description and instructions
   - Reference code display
   - Solution editor with Monaco
   - Hint system
   - Completion button
   - Achievement badges

### AI Integration
1. **Gemini 2.5 Flash Integration**
   - API key configuration
   - Prompt engineering for context generation
   - Exercise generation with structured output (JSON)
   - Error handling and fallbacks

## Implementation Plan
1. Create database models and migrations
2. Implement API controllers for context and exercises
3. Develop Stimulus controller for AI assistant UI
4. Build exercise view and completion system
5. Set up Gemini API integration with proper prompts
6. Add caching and performance optimizations
7. Implement achievement tracking

## Technical Considerations
- Secure API key storage using environment variables
- Caching to minimize API usage
- Database indexing for performance
- User authentication for tracking achievements
- Progressive enhancement for accessibility

## UI Mockups

### AI Assistant (Collapsed)
```
+---------------------------------------+
|                                       |
|                                       |
|                                       |
|                                       |
|                                       |
|                                       |
|                                       |
|                                       |
|                                       |
|                                       |
|                                       |
|                                       |
|                                       |
|                    [AI]               |
+---------------------------------------+
```

### AI Assistant (Expanded)
```
+---------------------------------------+
|                                       |
|                                       |
|                                       |
|                                       |
|                                       |
|                                       |
|                                       |
|                        +-----------+  |
|                        | AI ASSIST |  |
|                        | --------- |  |
|                        | Context   |  |
|                        | for file  |  |
|                        | --------- |  |
|                        | [Context] |  |
|                        | [Exercise]|  |
+---------------------------------------+
```

### Exercise View
```
+---------------------------------------+
| Exercise: Understanding Controllers   |
| -------------------------------------+|
| Description:                         ||
| Implement a new method that...       ||
|                                      ||
| Reference Code:                      ||
| +--------------------------------+   ||
| | class UsersController < Ap... |   ||
| +--------------------------------+   ||
|                                      ||
| Your Solution:                       ||
| +--------------------------------+   ||
| | def new_method                 |   ||
| |   # Your code here             |   ||
| | end                            |   ||
| +--------------------------------+   ||
|                                      ||
| [Hint] [Submit] [Mark as Complete]   ||
+---------------------------------------+
``` 