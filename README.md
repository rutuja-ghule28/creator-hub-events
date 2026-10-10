# Creator Hub Events

Build "CreatorConnect", a creator and event promotion platform, as a mobile-first responsive web app (React, Tailwind, shadcn/ui, Supabase for auth, database and realtime).

=====================
PRODUCT
=====================

A centralized platform where creators (actors, influencers, artists, public personalities) and organizers publish events like meet-and-greets, workshops, product launches and community meetups. The public discovers and registers for them in one place.
It solves: no single place to find creator events, hard to search by location or date, scattered registration info, outdated details, and no way to tell if an event is officially organized.

=====================
ROLES
=====================

Use Supabase Auth plus a separate user_roles table (never store roles on the profile). Roles: attendee (default on sign-up), creator, admin. Use a security-definer has_role() function in all RLS policies. Protect admin and creator routes on both the client and in RLS.

=====================
DESIGN SYSTEM
=====================

- Brand gradient (from the logo): #1E6BFF to #5B3CFF to #D63CF2. Use it only for primary buttons, the active tab and the ticket header.
- Night ink #0F1433 for text, mist #F4F5FB for background, trust green #0A8F6E for verification.
- Fonts: Sora for headings and numbers, Figtree for body text.
- Rounded cards (16 to 24px), generous spacing, tap targets of at least 44px, light and dark mode, visible keyboard focus.
- If an event has no uploaded image, generate an SVG cover (gradient, spotlight beams, crowd silhouette) with a palette chosen from the event id.
- Trust signals: a green "Official event" seal on admin-approved events and a blue tick next to verified creators. Show them everywhere an event or creator appears.
- Vary the layout: large cards in the carousel, compact rows in lists, a ticket with a notch and dashed tear line. No wall of identical cards.
- Copy: short, plain, sentence case. Buttons say exactly what they do ("Register now", "Confirm registration", "Submit for review", "Mark as official"). Errors say what is wrong and how to fix it. Empty states tell the user the next action.
- Add loading skeletons on every list.

=====================
DATABASE (Row Level Security on every table)
=====================

- profiles (id, full_name, phone, city, avatar_url)
- user_roles (user_id, role)
- creators (id, user_id, display_name, category, bio, avatar_url, verified boolean, verification_status, verification_docs)
- events (id, creator_id, title, type, description, starts_at, venue, area, capacity, status: pending | live | rejected | removed, cover_url)
- registrations (id, event_id, user_id, attendee_count, ticket_code unique, checked_in boolean)
- follows (user_id, creator_id)
- saved_events (user_id, event_id)
- announcements (id, event_id, body, created_at)
- reports (id, event_id, reporter_id, reason, note, status)
- notifications (id, user_id, title, body, event_id, read)
  Rules: attendees only see events with status "live". Creators manage only their own events. Admins can read and update everything.

=====================
ATTENDEE MODULE
=====================

Bottom tab bar: Discover, Saved, Tickets, Profile.

1. Discover: location pill ("Pune"), notification bell with a dot when unread, a headline "Meet your favourite creators, in person.", search box, filter chips for type (All, Meetup, Meet & greet, Workshop, Launch, Community) and date (Any date, This month, Next month). A "Happening soon" horizontal carousel with large cards, then a compact list of the remaining events. Empty state with a "Clear filters" button.
2. Event details: cover with back, share and save buttons, Official seal, title, creator row with Follow button, date and time, venue with a "Get directions" link, seats left with a progress bar (warn colour at 20 or fewer), about, organiser updates, "Something wrong? Report this event", and a sticky bottom bar with "Register now" (or "View your ticket" if already registered, or "Sold out").
3. Registration form with validation: full name, email, phone, number of attendees (1 to 4 stepper), and a summary box. On confirm, create the registration with a unique ticket code, reduce seats and create a notification.
4. Ticket screen: "You're in!" header, a ticket card with a gradient top, a notch with a dashed tear line, and a real scannable QR code (use a QR library) that encodes the ticket code, plus ticket id and attendee info.
5. My tickets, Saved events, Creator public profile (avatar, verified tag, bio, follower count, Follow button, upcoming events), Notifications (tap opens the event), Profile (stats, creators you follow with Unfollow, notification toggle).
6. Report event: a bottom sheet with reasons (Fake event, Impersonation, Outdated details, Inappropriate content) and an optional note. A reason is required. It inserts into reports and shows the toast "Report sent. Admins will review it."
7. "Become a creator" request: attendees submit category, bio and proof links, which creates a verification request.
8. Notifications use Supabase realtime so new ones appear without a refresh and the bell dot updates.

=====================
CREATOR MODULE
=====================

Bottom tab bar: Overview, Events, Create (highlighted).

- Overview: greeting with a "Verified creator" tag, a dark card showing registrations in the last 7 days with a small bar chart, three small stats (followers, page views, saves), an amber banner when events are waiting for admin review, and a list of live events with registration progress.
- Events: my events with status tags (Official, Awaiting review, Removed).
- Create event: a form with title, type chips, date, start time, venue, seats and description, with a live preview card at the top that updates as they type. Validate every field with inline errors (title at least 4 characters, future date, time, venue, at least 1 seat). "Submit for review" saves the event with status "pending".
- Manage event: seats registered and checked-in count, an Attendees tab where the creator ticks people off as checked in (updates registrations.checked_in), and an Announcements tab to post updates. Posting an announcement creates a notification for followers and registered attendees.

=====================
ADMIN MODULE
=====================

Bottom tab bar: Verify, Reports, Platform. Red count badges on Verify and Reports.

- Verify: two tabs, Events (n) and Creators (n). Event cards show cover, title, creator, date, venue and description, with "Reject" and "Mark as official". Approving sets status to "live" and notifies followers of that creator. Creator cards show the submitted documents with "Reject" and "Verify creator" (sets verified = true and shows the blue tick everywhere).
- Reports: each report shows reason, note, reporter, time and the event, with "Dismiss" and "Remove listing" (sets event status to "removed" and hides it from Discover).
- Platform: totals (users, verified creators, live events, needs review), a weekly registrations chart, and a user list with Suspend and Restore.

=====================
CONNECTED FLOW (must work end to end)
=====================

Creator submits an event -> it appears in the Admin Verify queue as pending -> Admin marks it as official -> it shows in Attendee Discover with the Official seal and followers get a notification -> Attendee registers and gets a QR ticket -> Creator sees the new attendee and ticks them off as checked in. Creator announcements notify followers. Attendee reports appear in the Admin Reports tab.

=====================
SEED DATA (Pune, India)
=====================

- 5 live events: "Sunset Acoustic Meetup" (Koregaon Park Amphitheatre), "Fan Meet & Greet with Aarav Kulkarni" (Balewadi Sports Complex Hall), "Reel Craft Workshop" (Baner Creator Studio), "Neon Beats Earbuds Launch" (Hinjewadi Tech Hub), "Open Mic Community Night" (Kalyani Nagar Café Stage). Use future dates, capacities between 30 and 200, and some already partly booked.
- 4 verified creators (Meera Joshi, Aarav Kulkarni, Kabir Sharma, Ishaan Deshmukh), 2 creators waiting for verification (Tara Nair, Nikita Rao), 2 pending events, 2 reports.
- Create demo accounts: one attendee, one creator (Meera Joshi) and one admin, and show their logins on the sign-in page for testing.

=====================
QUALITY
=====================

Make it work well at 390px wide, and on desktop show the app in a centered phone-width layout. Include loading, error and empty states everywhere. Check for console errors and fix them before finishing.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://creator-hub-events.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7c55d8ac-c7a6-4de3-a1f5-615cc9877693).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
