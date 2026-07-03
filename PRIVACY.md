# Privacy Policy for SphereSMM Dashboard

**Last updated: July 2026**

## Data We Collect

- **Email address and display name** — for authentication via Firebase Auth
- **Post content and media URLs** — content you compose, schedule, or publish through the dashboard
- **Social account references** — platform, username, display name, avatar URL (no access tokens stored on servers)
- **Analytics data** — impressions, engagements, clicks derived from published posts

## How We Use Your Data

- To authenticate you via Firebase Auth (email/password, Google, Facebook)
- To publish social media posts on your behalf to platforms you authorize (X/Twitter, Facebook, Instagram, LinkedIn)
- To generate AI caption suggestions via Google Gemini API
- To display analytics and performance metrics

## Data Storage

- **Authentication data** is handled by Firebase (Google Cloud infrastructure)
- **Post drafts and schedules** are stored in Firestore (Google Cloud)
- **Social media access tokens** are NEVER stored on our servers — they exist only in your browser memory during a publishing session and are immediately garbage collected

## Third-Party Services

| Service | Purpose |
|---------|---------|
| Firebase (Google) | Authentication, Firestore database |
| Google Gemini AI | AI caption generation |
| Meta (Facebook/Instagram) | Publishing to connected accounts |
| X (Twitter) | Publishing tweets |
| LinkedIn | Publishing posts |

## Data Security

- Access tokens are ephemeral — obtained fresh via OAuth popup at publish time
- No tokens are written to disk, database, logs, or localStorage
- Firestore security rules enforce per-user data isolation
- All API calls use HTTPS encryption

## Your Rights

You can request deletion of your data at any time by:

1. Emailing the contact address below with subject "Data Deletion Request"
2. Including your account email address
3. We will delete all associated data within 30 days

## Contact

**Email:** prdevcore@email.com

## Changes to This Policy

We may update this privacy policy. Changes will be posted to this URL.