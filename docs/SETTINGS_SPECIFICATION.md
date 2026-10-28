# Converge Application Settings Specification

**Status:** Product specification — settings inventory and intended behaviour  
**Scope:** Converge AI-Native Research & Community Platform  
**Important:** This document defines what settings should exist. It is not a claim that every item is already implemented. Existing functionality and proposed functionality are distinguished below.

## 1. Product principles

1. **One clear settings home:** Users should find personal settings from their profile/avatar menu and a dedicated Settings page, rather than hunting through unrelated screens.
2. **Scope must be obvious:** Personal settings affect one user; community settings affect one community; organisation/workspace settings affect that organisation; platform administration affects the whole service.
3. **Permission-aware:** Only authorised owners, administrators, or moderators should see and change controls for the scope they manage.
4. **Real controls, not decorative switches:** Every control must save, validate, provide success/error feedback, and affect the stated behaviour. Do not show unfinished controls as if they work.
5. **Secure by default:** Privacy, private-community access, account security, and data deletion must be enforced by server-side checks and database policies—not only by hiding UI.
6. **Safe changes:** Destructive actions require a clear explanation and confirmation. Sensitive actions may require re-authentication.
7. **Mobile-first and accessible:** Settings should work on small screens, have clear labels, keyboard access, visible focus states, and understandable error messages.
8. **Preserve approved product design:** Settings work must not alter the approved public landing page or its animations.

## 2. Settings information architecture

The settings experience should be organised by scope.

### A. Personal settings
Available to every signed-in user:
- Account and sign-in
- Profile and identity
- Preferences and accessibility
- Notifications
- Privacy and visibility
- AI and research preferences
- Connected applications
- Data and account management
- Help and support

### B. Community settings
Available according to community role:
- General
- Access and membership
- Posting and participation
- AI agents
- Moderation
- Notifications
- Danger zone

### C. Organisation/workspace settings
Available only where organisation/workspace settings are supported and the user has permission:
- Overview and identity
- Members and roles
- Access and invitations
- Communities and research spaces
- AI governance
- Integrations
- Data, audit and retention
- Billing/plan only if a real billing system is introduced
- Danger zone

### D. Platform administration
Restricted to authorised platform administrators:
- AI agent registry and defaults
- AI provider/runtime configuration
- Platform access and account administration
- Global safety and usage limits
- Service integrations
- Audit and operational health
- Feature availability
- Platform-wide policy controls

Platform administration must not be mixed into ordinary user settings.

## 3. Personal settings — detailed inventory

### 3.1 Account and sign-in
**Purpose:** Manage the user's account and authentication methods.

Settings and actions:
- Email address: display verified status; change email through a verified confirmation flow.
- Password: change/reset password when password authentication is enabled.
- Sign-in methods: show connected methods such as email/password or Google; allow linking/unlinking only when safe and supported.
- Google connection: show whether it is linked; do not imply a connection exists unless verified by the auth provider.
- Active sessions: list sessions/devices and provide sign-out controls where the auth system exposes this capability.
- Sign out: current session.
- Sign out of all sessions: only when supported by the authentication backend.
- Account status: explain any restriction or verification requirement.
- Delete account: explain consequences, require confirmation and re-authentication where appropriate, and execute a defined deletion/anonymisation workflow.

Acceptance criteria:
- Email changes require confirmation.
- Users cannot accidentally remove their only working sign-in method.
- Authentication secrets and tokens are never displayed.
- Account deletion clearly explains what happens to posts, replies, memberships, messages, and authored research records before confirmation.

### 3.2 Profile and identity
**Purpose:** Control how a person is represented across Converge.

Settings:
- Display name.
- Username/handle, with uniqueness validation and a clear explanation if changing it affects profile URLs.
- Profile photo/avatar: upload, replace, or remove.
- Bio/about.
- Role, professional title, or areas of interest (optional).
- Organisation/affiliation (optional and not treated as verified unless verified).
- Website or social links (optional, validated).
- Profile preview.
- Save/discard changes.

Acceptance criteria:
- Profile data is validated and saved to the user's own record only.
- Private information is not exposed through public profile pages by default.
- Image uploads have file type and size validation.

### 3.3 Preferences and accessibility
**Purpose:** Let users shape how the application feels and behaves.

Settings:
- Appearance: system/light/dark only if all modes are properly supported.
- Accent/theme preference only if it is compatible with the approved Converge brand system.
- Language: list only languages that the product genuinely supports.
- Time zone: automatic or manually selected, used consistently for dates/times.
- Reduced motion: respect operating-system preference and provide an explicit option if needed.
- Text density or readability options, if supported.
- Default landing destination after sign-in: e.g. Communities or last visited space, only after routes are stable.
- Keyboard shortcuts/help, if implemented.

Acceptance criteria:
- Preferences persist across sessions.
- Unsupported languages, themes, and shortcuts are not shown as available.
- Accessibility settings must not break core navigation or content.

### 3.4 Notifications
**Purpose:** Give users control over useful updates without overwhelming them.

Notification categories:
- Replies to the user's topics or comments.
- Mentions and direct interactions.
- Community join-request outcomes and membership changes.
- Community announcements or moderator actions.
- Direct messages and message requests.
- Organisation/workspace invitations and role changes.
- AI agent replies, research runs, and completed research artefacts.
- Security and account alerts.

Delivery controls:
- In-app notifications: on/off by category.
- Email notifications: on/off by category only when email delivery is implemented.
- Push notifications: only when a real push channel exists.
- Frequency/digest: immediate or daily/weekly digest only if supported.
- Quiet hours and time zone, if scheduled delivery is supported.
- Mark all as read and clear/read controls in the notification centre.

Acceptance criteria:
- Critical security notices cannot be silently disabled if policy requires them.
- A setting is not displayed until its delivery channel exists.
- Notification preferences are enforced by the sending logic, not merely stored in the UI.

### 3.5 Privacy and visibility
**Purpose:** Control what other users can discover or contact.

Settings:
- Profile visibility: public to signed-in users or restricted, only if the access model supports both.
- Discoverability in People/search.
- Show organisation/affiliation on profile.
- Who can send direct-message requests: everyone, people in shared communities, or nobody, only if these rules can be enforced.
- Who can mention/tag the user, if mention controls exist.
- Online/activity status, only if presence is implemented.
- Read receipts, only if messaging supports them.
- Blocked users list and unblock action, if blocking is implemented.
- Data-use/privacy notice and links to applicable policies.

Acceptance criteria:
- Privacy preferences have matching server-side enforcement.
- Private community content remains private regardless of profile visibility.
- Hiding a profile does not bypass moderation, security, or authorised organisation access.

### 3.6 AI and research preferences
**Purpose:** Let users customise their own AI-assisted research experience without overriding platform safety.

Settings:
- Default research response style: concise, balanced, or detailed.
- Preferred answer length: short / standard / detailed, with a platform safety ceiling.
- Preferred research focus or areas of interest.
- Default specialist agents to suggest, where the topic supports selection.
- Agent participation preference: suggest agents before inviting, or use the user's chosen default, if the workflow supports it.
- Citation/source preference: prioritise cited evidence when available; never promise citations when the provider cannot supply them.
- Research history visibility to the user and retention information.
- AI feature opt-in/consent where required.
- Feedback controls: report an unhelpful answer, too-long answer, inaccurate answer, or inappropriate response.

Acceptance criteria:
- Personal preferences influence defaults but do not override community-owner rules, permissions, platform safety, or provider limits.
- AI-generated content is not represented as verified fact merely because a user selected a preference.
- Controls must map to actual runtime behaviour; otherwise label them as planned and keep them out of the live UI.

### 3.7 Connected applications
**Purpose:** Manage integrations and authorisations.

Settings:
- List connected services and the permissions granted.
- Connect/disconnect only supported providers.
- Show connection status and last successful connection when available.
- Revoke access and explain effects.
- Never display API keys, OAuth tokens, or secrets.

Acceptance criteria:
- Only real integrations appear.
- Revoking access invalidates stored credentials/tokens where applicable.
- Integration secrets remain server-side.

### 3.8 Data and account management
**Purpose:** Help users understand and manage their data.

Settings/actions:
- Download/export personal data, if an export workflow is implemented.
- Request account deletion.
- Explain data retention for posts, replies, messages, AI executions, and research artefacts.
- Explain which content is deleted, retained for legitimate operational/security reasons, or anonymised.
- Privacy policy and terms links.
- Request correction or support for data issues.

Acceptance criteria:
- Do not advertise export or deletion controls until the backend workflow exists and is tested.
- Deletion behaviour must be consistent across relational records, storage objects, and dependent records.
- The UI must not promise complete erasure where legal, security, or integrity requirements require limited retention.

## 4. Community settings — detailed inventory

Community settings belong to each community and must reflect the current user's role.

### 4.1 General
- Community name and unique slug.
- Description and purpose.
- Avatar/cover image, if supported.
- Topic/category/tags, if supported.
- Community owner and visible moderators.
- Save/discard changes.

### 4.2 Access and membership
- Visibility: public or private.
- Join policy: open membership for public communities; request-to-join and owner/moderator approval for private communities.
- Pending join requests: review, approve, reject; show status and decision feedback.
- Member list and member roles.
- Remove member, with confirmation and permission checks.
- Invite members, if invitation flow is implemented.
- Transfer ownership, with explicit confirmation and re-authentication where appropriate.
- Leave community; warn owners if ownership transfer is required first.

Rules:
- Private content must not be exposed to non-members through pages, APIs, search, agent history, or artefacts.
- Only authorised owners/moderators can approve requests or change access settings.
- A user's ability to view or join a community must be evaluated server-side.

### 4.3 Posting and participation
- Who can create topics: owner-controlled setting.
- Who can reply: members or other defined roles, only if supported.
- Topic/reply moderation controls, if implemented.
- Community guidelines/rules text.
- Pinned or featured topic controls, if implemented.
- Rate limits and spam controls should be platform-enforced; community overrides require safe bounds.

### 4.4 AI agents
- Enable/disable AI participation for the community, if supported.
- Agent roster available to members.
- Add or remove community-owned custom agents.
- Agent name, role/specialty, description, and owner-defined system guidance.
- Participation guidance: when to contribute, what to focus on, what to avoid.
- Response style preference and default length within platform-enforced limits.
- Permissions/capabilities, with clear descriptions and least-privilege defaults.
- Test agent configuration before saving, if a safe test flow is available.
- View recent runs/errors and usage where authorised.

Rules:
- Community owners can customise role and voice but cannot override platform safety, privacy, permissions, or mandatory response limits.
- Agents must not gain access to content the current user or community cannot access.
- Capability names must correspond to real implemented capabilities; do not present speculative capabilities as active.

### 4.5 Moderation
- Moderator list and role assignment.
- Report queue and resolution actions, if reports are implemented.
- Remove/restore topic or reply, if moderation actions exist.
- Member restrictions or removal, with audit history where appropriate.
- Community rules and escalation path.
- Moderation action history for authorised moderators.

### 4.6 Notifications and danger zone
- Community activity notifications for the current user.
- Leave community.
- Archive/delete community only if implemented and only for authorised owners.
- Confirm destructive actions and explain impact on topics, members, agent configurations, and artefacts.

## 5. Organisation and workspace settings

These controls should be implemented only where the organisation/workspace data model and role system support them.

### 5.1 Overview and identity
- Organisation/workspace name, slug, description, logo, website.
- Verified status only when a real verification process exists.
- Owner and administrators.

### 5.2 Members and roles
- Invite/remove members.
- Assign and revoke roles.
- Define role capabilities centrally and show each role's permissions.
- Review pending invitations.
- Prevent removal or demotion of the last owner without transferring ownership.

### 5.3 Access and research spaces
- Default visibility for new spaces.
- Who may create communities/research spaces.
- External member or guest access, if supported.
- Data boundaries between organisations.
- Organisation-specific participation guidance.

### 5.4 AI governance
- Approved agent roster.
- Allowed capabilities and data access.
- Default response style and usage limits within platform policy.
- Human approval requirements for consequential actions, if such actions are introduced.
- Auditability of agent activity and administrative changes.

### 5.5 Integrations, audit and retention
- Supported organisation integrations and their connection state.
- Administrative audit log.
- Retention settings only if configurable and enforced.
- Export/access requests for authorised administrators.
- No billing controls until plans, subscriptions, and payment handling exist.

## 6. Platform administration settings

These are not ordinary user preferences and must be protected by server-side administrator authorization.

### 6.1 AI agent registry
- Agent name, stable ID/key, role, description, specialty, and default prompt.
- Capabilities and permissions.
- Participation guidance and intended use.
- Enabled/disabled status.
- Default/fallback agent behaviour.
- Version history and last editor.
- Test configuration and review before publishing, where feasible.

### 6.2 AI runtime and response quality
- Provider/model configuration through server-side environment/configuration.
- Global response length and formatting limits.
- Distinct voice profiles per specialist.
- Safety rules that cannot be overridden by community prompts.
- Timeout, retry, and failure behaviour.
- Usage/cost limits if the provider supports measurement.
- Logging that avoids storing unnecessary sensitive content.

Secrets must never be rendered in the browser or stored in public configuration. Runtime changes should be validated and have a rollback path.

### 6.3 Platform access and operations
- Administrator membership and role changes.
- Global feature availability, only if feature flags are implemented.
- Rate limits and abuse controls.
- Service health and recent failures, if monitoring is connected.
- Audit log for privileged actions.
- Data export/deletion request handling, if supported.

## 7. Global interaction requirements for every setting

Every setting must define:
- **Owner/scope:** personal, community, organisation/workspace, or platform.
- **Authorisation:** who may view and edit it.
- **Default:** what happens before the user changes it.
- **Persistence:** where it is saved and how it is loaded.
- **Enforcement:** where the saved value changes product behaviour.
- **Validation:** valid values, required fields, and constraints.
- **Feedback:** loading, saved, validation error, and server error states.
- **Auditability:** whether changes need an audit event.
- **Destructive impact:** confirmation and recovery path, if applicable.
- **Tests:** permission, persistence, behaviour, and failure cases.

Save behaviour:
- Prefer explicit Save/Cancel for multi-field forms.
- Use immediate save only for simple toggles, with clear saving/error feedback.
- Do not show “Saved” until the server confirms persistence.
- Protect against unsaved changes being lost.
- Do not silently overwrite newer server data.

## 8. Suggested delivery phases

### Phase 1 — Settings foundation
1. Establish a dedicated personal Settings entry point and navigation.
2. Complete Account and Profile settings using existing authentication/profile support.
3. Audit current notification functionality and expose only settings that actually work.
4. Document and test existing community settings.
5. Make loading, save, validation, and error states consistent.

### Phase 2 — Privacy and research preferences
1. Add privacy controls only where server-side enforcement is ready.
2. Add AI response-style preferences and connect them to the runtime.
3. Add account/data management workflows after backend behaviour is defined.
4. Add supported integration management only when a real provider exists.

### Phase 3 — Organisation and platform governance
1. Define organisation/workspace roles and permissions.
2. Complete admin AI registry, prompts, capabilities, and versioning.
3. Add operational audit views and governance controls.
4. Add retention, export, and feature controls only with complete backend enforcement.

## 9. Definition of done

A settings area is complete only when:
- Its scope and permissions are clear.
- Each displayed control is implemented end to end.
- Saved values persist after refresh and re-login where appropriate.
- The relevant product behaviour changes as documented.
- Unauthorized users cannot bypass the control through API requests.
- Empty, loading, error, and success states are handled.
- Destructive actions are confirmed and tested.
- Mobile and keyboard accessibility are checked.
- Documentation states any limitations honestly.

## 10. Current implementation note

The codebase currently contains community settings at `app/communities/[slug]/settings/page.tsx`, profile UI at `app/profile/page.tsx`, notifications at `app/notifications/page.tsx`, and platform agent administration at `app/admin/agents/page.tsx`. These are existing areas to audit against this specification. The presence of a page does not mean every control described in this document is already implemented or fully enforced.
