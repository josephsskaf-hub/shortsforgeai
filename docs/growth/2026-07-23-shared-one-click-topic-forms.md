# 2026-07-23 - Shared one-click topic forms

## Objective

Convert existing organic traffic on high-intent landing pages into preserved first-video intent without requiring visitors to invent, type, and then submit a topic before they can see value.

## Verified evidence

In the latest seven-day acquisition report, `/youtube-shorts-from-topic` produced 14 landing events, making it the highest-traffic non-home public intent page. Its measured topic submissions were zero.

The shared `TopicGeneratorForm` already displayed example topics, but clicking an example only copied text into the textarea. The visitor still had to understand that nothing had started and then find and press the separate submit button.

## PUSH #70 change

- Example topic buttons now start the signup-to-Fast workflow immediately.
- The exact topic, `create_intent=fast`, campaign, and optional language survive the navigation.
- Each click writes both `organic_topic_example_started` and the established `organic_topic_submitted` event.
- The button arrow communicates that the action advances instead of merely filling text.
- Free-form typing and manual submit remain unchanged.
- Because the component is shared, the improvement also reaches the faceless generator, free generator, text-to-video, no-filming, Quso decision, faceless-ideas, and Portuguese intent pages while retaining their existing campaign attribution.
- The default `/youtube-shorts-from-topic` cohort is separately reported as `push70YouTubeTopicOneClick` through landing, example start, signup, completed first video, pricing, checkout, recurring Stripe session, and active/trialing subscription.

## Decision gate

Review after 30 qualified `/youtube-shorts-from-topic` sessions or seven days:

- At least 3 example starts or topic submissions.
- At least 2 attributed signups.
- At least 1 completed first video.
- At least 1 pricing view and authenticated checkout attempt.
- Commercial success requires at least 1 paid recurring subscription.

If example starts stay at zero, the problem is offer/proof relevance rather than form friction. If starts rise but signup remains zero, reduce authentication friction without weakening abuse controls. If first videos complete but checkout remains zero, improve the clean-export upgrade moment.
