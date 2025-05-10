# Next Feature Ideas for Primeta

## 1. Leaderboard
**Idea:**
- Display a ranked list of users based on points, achievements, or activity (e.g., files explored, challenges completed).

**How to Execute:**
- Add a `points` or `score` attribute to the `User` model, updated by user actions (exploring files, completing challenges, etc.).
- Create a new Leaderboard page that queries and displays the top users.
- Optionally, show weekly/monthly leaderboards and personal rank.
- Add gamification elements (badges, streaks).

---

## 2. Public Profiles & Shareable Achievements
**Idea:**
- Each user has a public profile page showing their stats, achievements, and repositories explored.
- Users can share their achievements or profile links.

**How to Execute:**
- Add a public profile route (e.g., `/users/:username` or `/profiles/:id`).
- Display user stats: total files explored, challenges completed, badges earned, etc.
- Add privacy controls for users to opt-in/out of public profiles.
- Implement shareable achievement cards (image or rich link previews).

---

## 3. Social Media Sharing
**Idea:**
- Let users share when they start exploring a repository or earn an achievement (e.g., "I just started exploring React on Primeta!" or "I earned the 'Rails Expert' badge!").

**How to Execute:**
- Add share buttons (Twitter/X, LinkedIn, Facebook, etc.) on repository and achievement pages.
- Pre-fill share text and images (Open Graph tags for rich previews).
- Optionally, generate dynamic images for achievements using a service like Cloudinary or custom Rails endpoints.

---

## 4. Code Scavenger Hunt
**Idea:**
- Create interactive scavenger hunts where users must find and explore specific files, patterns, or concepts in a codebase.
- Reward users for completing hunts.

**How to Execute:**
- Define scavenger hunt templates (e.g., "Find the main controller file", "Locate a use of the Singleton pattern").
- Track user progress as they visit required files or answer clues.
- Show progress and give rewards/badges for completion.
- Optionally, allow community-created hunts.

---

## 5. Improved Challenges in Code
**Idea:**
- Make code challenges more interactive, contextual, and adaptive to user skill.
- Include multiple types: multiple choice, code fill-in, debugging, etc.

**How to Execute:**
- Expand the challenge model to support different question types and difficulty levels.
- Use AI to generate or adapt challenges based on the file and user history.
- Add instant feedback and explanations for answers.
- Track challenge performance for user stats and achievements.

---

## 6. Job Board
**Idea:**
- Provide a curated job board for developers, featuring roles from companies interested in hiring Primeta users or those with open source experience.

**How to Execute:**
- Add a Job Board page listing open positions, with filters for tech stack, remote/on-site, and experience level.
- Allow companies to submit job postings (with moderation/approval flow).
- Integrate with user profiles to highlight relevant jobs based on explored repositories or achievements.
- Optionally, allow users to apply directly or link to external application pages.
- Track job applications and provide analytics for companies.

---

## 7. Paddle Subscription Integration
**Idea:**
- Integrate Paddle as the payment processor for handling user subscriptions, billing, and invoicing.

**How to Execute:**
- Set up Paddle account and configure webhooks for subscription events (signup, renewal, cancellation, payment failure).
- Implement subscription management UI for users (upgrade, downgrade, cancel, view invoices).
- Sync Paddle subscription status with user roles/access in the app.
- Ensure compliance with tax/VAT requirements and global payments.
- Add admin dashboard for managing subscriptions and viewing analytics.

---

## General Notes
- Prioritize features that increase engagement and sharing.
- Use analytics to measure feature adoption and iterate.
- Consider mobile/responsive design for all new features. 